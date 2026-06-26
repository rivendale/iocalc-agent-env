# Game Theory Patterns for IOCALC

IOCALC can use game theory as educational strategy vocabulary for a settlement
game. These patterns are for sandbox gameplay and agent learning only. They are
not trading strategies, financial advice, market data tools, or real-world
execution systems.

## Pattern: Payoff Matrix

Show how two settlement commands interact.

Example actions:

- cooperate
- fortify
- expand
- pressure

Example display:

```text
left fortifies + right expands -> left safety improves, right growth improves
left pressures + right expands -> right takes damage risk
both pressure -> both morale falls and damage risk rises
```

Use this to teach that a command is only good relative to the rival command.

## Pattern: Repeated Game

Season Duel is a repeated game. A command can be strong this season and harmful
over several seasons.

Useful mechanics:

- trust or stability score
- repeated pressure creates morale cost
- repeated cooperation creates trade or signal bonus
- repeated greedy expansion increases damage risk

## Pattern: Prisoner Choice

Two settlements can both benefit from restraint, but each can gain a short-term
edge by applying pressure.

Sandbox use:

- make pressure tempting
- make mutual pressure costly
- show the season report explaining why

Do not frame this as markets or trading.

## Pattern: Signaling

Agents act under partial information. Signals reduce uncertainty.

Sandbox use:

- scouting improves rival-intent estimate
- signal relay improves report accuracy
- deceptive pressure can create short-term ambiguity
- high uncertainty increases fallback likelihood

## Pattern: Equilibrium Break

A match can settle into repeated commands. An equilibrium break is a deliberate
change when current behavior stops improving the objective.

Sandbox use:

- detect repeated command patterns
- apply diminishing returns to repeated single-strategy play
- recommend a counter-strategy through the verifier
- explain the tradeoff in the season report

## Pattern: Crowded Strategy

If every agent chooses the same obvious action, its marginal value should fall.

Sandbox use:

- repeated farms can hit storage or labor limits
- repeated wall work can waste energy after damage is low
- repeated pressure raises instability
- repeated scouting has diminishing returns without action

## Pattern: Asymmetric Information

Each side may have different visibility into resources, intent, or damage.

Sandbox use:

- limited rival details until scouting improves
- report confidence bands
- agent rationale notes when it acted under uncertainty

## Protocol Implications

The agent environment should eventually expose enough structured state for these
patterns without exposing hidden implementation details:

- current season
- visible resources
- visible damage
- pressure
- command source
- fallback markers
- report confidence
- match history
- verifier notes

## Safety Boundary

Game theory patterns must remain inside IOCALC sandbox gameplay. They must not
introduce:

- real market data
- trading signals
- broker or exchange connectors
- wallet actions
- transaction requests
- financial predictions
- financial advice
- autonomous treasury behavior
