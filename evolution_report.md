**Status**: [SUCCESS]

**Changes**: 
- **Optimization**: Enhanced `skills/arxiv-watcher` with a new `--limit <n>` flag to control result count (previously hardcoded to 10).
- **Refactoring**: Removed unused `extractTag` function and improved XML regex parsing to robustly handle both single and double quotes in attributes.
