# Performance Benchmarks

Performance benchmarks for the ohmyblack system using Vitest's benchmarking capabilities.

## Running Benchmarks

```bash
# Run all benchmarks
npx vitest bench

# Run specific benchmark file
npx vitest bench template-engine

# Run with detailed output
npx vitest bench --reporter=verbose

# Run benchmarks and compare with baseline
npx vitest bench --compare
```

## Benchmark Structure

### Template Engine (`template-engine.bench.ts`)

Measures performance of the template engine including:
- Compilation speed for various template complexities
- Rendering speed with different data sizes
- Caching effectiveness
- Helper chain performance

### Workflow Execution (`workflow-execution.bench.ts`)

Measures workflow management performance:
- Workflow creation with varying task counts
- Dependency resolution
- Task availability checks
- Execution plan generation
- Task assignment and completion

### Team Composition (`team-composition.bench.ts`)

Measures team auto-composition performance:
- Template selection algorithms
- Requirements analysis
- Team composition with various constraints
- Fitness score calculation
- Validation performance

## Benchmark Results

Results are system-dependent. Run benchmarks on your target environment.

### Template Engine

| Operation | Baseline Target | Notes |
|-----------|----------------|-------|
| Compile simple template | < 1ms | Basic variable substitution |
| Compile complex template | < 5ms | With loops and conditionals |
| Render simple (1 var) | < 0.1ms | Single variable |
| Render complex (10 items) | < 1ms | Loop with 10 items |
| Render complex (100 items) | < 10ms | Loop with 100 items |
| Render complex (1000 items) | < 100ms | Loop with 1000 items |
| Cached rendering (100x) | < 10ms | Template compiled once |

### Workflow Execution

| Operation | Baseline Target | Notes |
|-----------|----------------|-------|
| Create workflow (5 tasks) | < 5ms | Simple workflow |
| Create workflow (20 tasks) | < 20ms | Medium workflow |
| Create workflow (50 tasks) | < 50ms | Large workflow |
| Get available tasks (20) | < 1ms | Check dependencies |
| Update dependencies (20) | < 2ms | Unblock tasks |
| Generate execution plan (20) | < 5ms | Critical path analysis |
| Auto-assign tasks | < 3ms | Match tasks to members |

### Team Composition

| Operation | Baseline Target | Notes |
|-----------|----------------|-------|
| Select template | < 1ms | Complexity-based selection |
| Analyze requirements | < 2ms | Keyword analysis |
| Simple composition | < 10ms | Minimal team |
| Complex composition | < 20ms | Full-stack team |
| Calculate fitness score | < 5ms | Multi-factor scoring |
| Validate composition | < 2ms | Constraint checking |

## Performance Targets

Based on expected usage patterns:

- **Template Operations**: Should feel instantaneous (< 10ms for most operations)
- **Workflow Management**: Should handle 50+ tasks efficiently (< 100ms)
- **Team Composition**: Should compose optimal teams in under 50ms

## Optimization Notes

### Template Engine

**Current optimizations:**
- Compiled templates are cached
- Regex patterns are pre-compiled
- Helper resolution is optimized with Map lookups

**Potential optimizations:**
- Pre-compile commonly used templates
- Lazy evaluation for conditional blocks
- String builder pattern for large outputs

### Workflow Execution

**Current optimizations:**
- Immutable state updates prevent unnecessary copying
- Dependency maps are pre-calculated
- Task status checks use Set for O(1) lookups

**Potential optimizations:**
- Incremental dependency updates
- Task queue data structure
- Parallel task processing

### Team Composition

**Current optimizations:**
- Template selection uses decision trees
- Capability matching uses Set operations
- Fitness scoring is cached

**Potential optimizations:**
- Memoize analysis results
- Pre-compute capability coverage
- Parallel fitness evaluation

## Continuous Monitoring

To track performance over time:

1. Run benchmarks before major changes
2. Save baseline results
3. Compare with new benchmarks
4. Investigate regressions > 10%

```bash
# Save baseline
npx vitest bench --reporter=json > baseline.json

# Compare with baseline
npx vitest bench --compare baseline.json
```

## Contributing

When adding new benchmarks:

1. Use descriptive names
2. Cover realistic scenarios
3. Test with varying input sizes
4. Document expected targets
5. Include edge cases

Example structure:

```typescript
bench('operation description (size)', () => {
  // Setup
  const data = createTestData();

  // Operation to benchmark
  performOperation(data);
});
```

## Performance Issues

If benchmarks show performance degradation:

1. **Profile the code**: Use Node.js profiler
2. **Check algorithms**: Look for O(n²) operations
3. **Review data structures**: Ensure optimal choices
4. **Consider caching**: Add memoization where beneficial
5. **Optimize hot paths**: Focus on frequently called functions

## Related Documentation

- [Vitest Benchmarking](https://vitest.dev/api/bench.html)
- [Performance Best Practices](../docs/performance.md)
- [Architecture Overview](../docs/architecture.md)
