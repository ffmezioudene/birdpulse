#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Wire up dead Home screen elements — All › buttons, category cards, explore chips, article cards — to functional destinations with spring press feedback and FeatherWave loading/empty states."

frontend:
  - task: "Home → destinations navigation + press feedback + audio playback"
    implemented: true
    working: true
    file: "app/(tabs)/index.tsx, app/popular-birds.tsx, app/birds-near-you.tsx, app/category/[id].tsx, app/article/[id].tsx, src/components/PressableScale.tsx, src/components/BirdCallPlayer.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Added PressableScale (Reanimated spring + haptic) and BirdCallPlayer (live Xeno-canto playback via expo-audio). Wired Home All-buttons, category cards, popular cards, article cards, explore chips. Polished destinations with search/filter/related sections."
        -working: true
        -agent: "testing"
        -comment: "iteration_2: 10/10 nav flows pass. Flagged HIGH: nested <button> on web — play press bubbled to parent card."
        -working: true
        -agent: "main"
        -comment: "Restructured all 4 affected screens to hoist BirdCallPlayer into a sibling View outside the parent PressableScale."
        -working: true
        -agent: "testing"
        -comment: "iteration_3: 12/12 checks PASS, zero nested buttons, zero hydration warnings, play no longer navigates. Fix verified."

backend:
  - task: "Xeno-canto v3 proxy w/ scientific name support"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Endpoint already existed. Improved query: accepts scientific Latin (Genus species) as raw token or common name as en:'...'. Returns clear note when XENO_CANTO_KEY is unset (v2 is deprecated, v3 requires free key from xeno-canto.org)."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 3
  run_ui: true

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "Home navigation rewire complete and verified (iteration_3). Spring press feedback live across Home + Popular Birds + Birds Near You + Category + Article reader. BirdCallPlayer ready — currently shows 'Unavailable' label because no XENO_CANTO_KEY is set; user can add a free key from xeno-canto.org to unlock playback."

    -agent: "main"
    -agent: "main"
    -message: "Iteration 6 — Home Perfection Pass (8/8 + 5/5 regressions PASS). Fixes: (1) owl FAB now pinned bottom:100 right:16, never overlaps cards; (2) 3-stop scrim ['transparent','rgba(10,11,10,0.55)','rgba(10,11,10,0.96)'] @ [0,0.45,1] on every image card; (3) one consistent card language — 20px radius/padding everywhere; (4) reorder = Header → Search → Identify → Bird of the Day → Birds Near You → Popular → Explore; (5) Bird of the Day card (deterministic by day-of-year); (6) Birds Near You shows 'Active in {month}' subtitle; (7) staggered FadeInDown 50/100/150/200/250/300ms entrance; (8) '216 instant' badge REMOVED from search bar."
    -agent: "main"
    -message: "Iteration 7 — Richer Bird Detail (8/8 backend + frontend ALL PASS). Extended GPT-4o schema with 7 new fields (behavior, sexDifferences, weight, lifespan, seasonality, populationTrend, confusedWith[]). New Description tab cards: collapsible Overview/HowToID/KeyFacts/Diet/Habitat/Behavior/Sex differences/Nesting/When-to-look, Conservation w/ IUCN colored dot + trend chip, Scientific classification (Order/Family/Genus/Species), Often-confused-with horizontal row of real Wikipedia photos w/ distinguishing tips, Did-you-know, and the killer Ask-Owl CTA (passes birdContext to /chat). Range tab: smoother month scrubber with current-month sage outline + 'May today' pill + helper text. Cache version bumped v1→v2. Fixed badge flicker: 'Offline ready' now driven by hasPrecachedDetail(id) instead of source field."


    -message: "Iteration 5 — Real Wikipedia thumbnails everywhere (12/12 + 8/8 PASS). New: src/components/SpeciesThumb.tsx (shimmer → expo-image → leaf-only-on-genuine-miss), src/lib/thumb-cache.ts (in-memory + AsyncStorage batch queue), POST /api/birds/thumbs (MediaWiki pageimages 50/req batch). Leaf placeholder has effectively vanished from normal use. 9 batch calls per session, all <2s. Precached birds still INSTANT."

    -agent: "main"
    -message: "Species Data Backbone shipped (iteration_4). 11,145 species local index + 216 pre-cached famous birds + Wikipedia/GPT-4o hybrid loader. 15/15 frontend + 8/8 backend tests pass. Search latency <300ms, bird detail instant first paint <100ms (precache), Wikipedia <1.5s, AI enrichment ~3s. Bundle adds ~2 MB (1.85 MB index + 178 KB precache)."
