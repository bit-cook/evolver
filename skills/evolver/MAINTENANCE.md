# MAINTENANCE.md - Evolution Engine Rules

## 🧬 Core Maintenance Protocols

### 🔗 Wrapper Synchronization (Decoupling Policy)
**Effective Date**: 2026-02-03
**Trigger**: Any modification to `index.js`, `evolve.js`, or the CLI/Env interface.

**The Rule**:
> "Evolution is not isolated. When the Core evolves, the Wrappers must adapt."

**Procedure**:
1.  **Check Sibling**: Before committing changes to Core (`capability-evolver`), check if `../feishu-evolver-wrapper` exists.
2.  **Verify Interface**:
    - Did you add a new CLI flag? (e.g., `--new-mode`) -> Update Wrapper to pass it.
    - Did you change an ENV var name? -> Update Wrapper to inject it.
    - Did you change the Reporting Logic? -> Update Wrapper's `EVOLVE_REPORT_DIRECTIVE`.
3.  **Sync**: If changes are needed, generate a patch for the Wrapper in the same Evolution Cycle.

**Goal**: Zero "running back and forth". The Evolution Engine is responsible for its own ecosystem integrity.

### 🛡️ Safety
- **No Hard Dependencies**: The Core must NEVER `require()` the Wrapper. The relationship is strictly One-Way (Wrapper wraps Core).
- **Graceful Failure**: If the Wrapper is broken, the Core must still function in standalone mode.