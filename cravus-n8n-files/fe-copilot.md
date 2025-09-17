ROLE: Senior RN/Expo engineer.
TASK: Implement the feature from SPEC below inside /src for Expo SDK 53.
OUTPUT: Unified diff patch only. No prose. Keep changes ≤200 LOC.
CONSTRAINTS:
- TypeScript strict. Use existing theme/hooks/components.
- Do not add libraries unless you also patch package.json.
- Cover loading/empty/error UI states where applicable.
- Accessibility: Pressable hitSlop and labels.
SPEC:
{{ $json.spec }}
CODEBASE TREE (first 400 files):
{{ $json.tree }}
KNOWN CONVENTIONS:
- Navigation via RootStack/RootTabs.
- Async data via supabase-js client in src/lib/supabase.ts (if present).
TESTS:
- If you add a component, include a minimal Jest snapshot; else a unit test for any new util/hook.
