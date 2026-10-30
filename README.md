# Paper trading results

A static page showing hypothetical, paper-only P&L for a set of prediction-market strategies.
No real money is traded.

The page reads `data/results.json`, which is regenerated and committed on a schedule.
It contains only aggregate numbers per strategy (P&L, open and closed position counts) under
neutral labels. The page has no connection to any trading system; it only loads files from
this repository.
