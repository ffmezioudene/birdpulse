"""
Tiny LLM client shim. Public-PyPI-only replacement for
`emergentintegrations.llm.chat` so production hosts (Railway, Render, Fly,
plain VPS) can install dependencies without access to Emergent's private
package index.

Surface area matches what `server.py` actually uses:
    - LlmChat(api_key, session_id, system_message)
        .with_model(provider, model)
        .send_message(UserMessage) -> str
    - UserMessage(text: str, file_contents: list = [])
    - ImageContent(image_base64: str)

Only the OpenAI provider is supported. The Gemini-audio code paths that
previously relied on `FileContentWithMimeType` have been removed from
`server.py` (Sound ID now runs entirely through Modal Perch 2.0), so this
shim does not implement that surface.

Direct dependency: `openai` (public PyPI). The OpenAI SDK is already used
by millions of production apps and is trivially installable everywhere.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, Union

from openai import AsyncOpenAI


# ---------------------------- Message primitives ----------------------------

@dataclass
class ImageContent:
    """Base64-encoded image payload (no data: URI prefix). The shim attaches
    it to the chat completion as `image_url` content using a data-URI."""
    image_base64: str
    mime_type: str = "image/jpeg"


@dataclass
class UserMessage:
    """A single user turn. `file_contents` may include ImageContent items
    (for vision). Anything else is silently ignored — matches the old
    emergent integration behavior for unrecognized content types."""
    text: str
    file_contents: List[Union[ImageContent]] = field(default_factory=list)


# ---------------------------- Chat client -----------------------------------

class LlmChat:
    """Stateless wrapper that issues a single `chat.completions.create`
    against OpenAI. Session ID is accepted for API compatibility but unused
    (we don't persist server-side conversation state; each `send_message`
    is a one-shot completion, same as the original integration's behavior
    for non-streaming calls).
    """

    def __init__(
        self,
        api_key: str,
        session_id: Optional[str] = None,
        system_message: Optional[str] = None,
    ) -> None:
        if not api_key:
            raise ValueError("LlmChat requires a non-empty api_key")
        self._api_key = api_key
        self._session_id = session_id  # kept for parity, unused
        self._system_message = system_message
        self._model_name: Optional[str] = None

    def with_model(self, provider: str, model: str) -> "LlmChat":
        """Match the fluent builder used by server.py.

        Only the `openai` provider is supported. Calling with any other
        provider raises immediately so misconfiguration surfaces in tests
        rather than at request time."""
        p = (provider or "").strip().lower()
        if p != "openai":
            raise NotImplementedError(
                f"llm_shim only supports the 'openai' provider in this build "
                f"(got {provider!r}). To re-enable other providers, expand "
                f"this shim or restore the original integration."
            )
        self._model_name = model
        return self

    async def send_message(self, message: UserMessage) -> str:
        """One-shot chat completion. Returns the assistant's reply text.

        Vision (image) inputs are passed as base64 data URIs in the new
        OpenAI multi-modal content format. Text-only inputs use the
        simpler `content: str` shape.
        """
        if not self._model_name:
            raise RuntimeError("with_model(...) must be called before send_message(...)")

        client = AsyncOpenAI(api_key=self._api_key)

        # Pull out any image attachments. Anything else in `file_contents`
        # is ignored (this is by design — the old API did the same for
        # unrecognized types and the only call sites in server.py use
        # ImageContent or nothing).
        images: List[ImageContent] = [
            c for c in (message.file_contents or []) if isinstance(c, ImageContent)
        ]

        # Build the user content as either a plain string (text-only,
        # cheaper / faster path) or the multi-modal array.
        if images:
            user_content: list = [{"type": "text", "text": message.text}]
            for img in images:
                user_content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{img.mime_type};base64,{img.image_base64}",
                        # "high" gives better detail on bird plumage marks
                        # without much extra cost vs the default.
                        "detail": "high",
                    },
                })
        else:
            user_content = message.text

        msgs: list = []
        if self._system_message:
            msgs.append({"role": "system", "content": self._system_message})
        msgs.append({"role": "user", "content": user_content})

        try:
            resp = await client.chat.completions.create(
                model=self._model_name,
                messages=msgs,
                # No temperature / max_tokens override — let the model
                # defaults stand, matching the prior integration's behavior.
            )
        finally:
            # AsyncOpenAI manages its own connection pool internally, but
            # we close per-call to avoid leaking connections in long-lived
            # processes (FastAPI workers under uvicorn).
            try:
                await client.close()
            except Exception:
                pass

        choice = resp.choices[0] if resp and resp.choices else None
        if not choice or not choice.message:
            return ""
        return choice.message.content or ""
