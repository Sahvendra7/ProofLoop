# ADR-004: Match tiers and a shown ranking key instead of a match percentage

**Decision.** Products get a categorical tier (strong / good / possible) from explicit rules and are ordered by a lexicographic key shown to the user: tier → other attention-band concerns addressed → other moderate-band concerns addressed → price → id.

**Context.** The MVP showed "Match 87%" from base 60 + ad-hoc bonuses capped at 99. There is no outcome data to calibrate any percentage.

**Options.** Keep a weighted score; use an LLM to rank; tiers + transparent ordering.

**Why.** Every number the user sees should mean something. Tiers map one-to-one to stated rules; the ordering is reproducible and testable. An LLM could invent product claims.

**Trade-offs.** Coarser than a score; ties are common (broken by price, then id).

**Revisit when.** Real outcome data (trial verdicts per product) exists to fit and validate a score.
