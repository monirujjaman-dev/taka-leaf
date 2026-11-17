#!/usr/bin/env bash
# Prints the kind of a pull request from its head and base branch names, or fails with a reason.
# The one place the branching model is written down in code; docs/GIT-WORKFLOW.md explains it.
#
#   branch-kind.sh <head> <base>
#
# Kinds:
#   feature fix docs chore refactor perf test ci claude   work branch  -> develop (squash)
#   hotfix                                                hotfix/<x>   -> main    (squash)
#   release                                               develop      -> main    (merge commit)
#   sync                                                  main         -> develop (merge commit)
set -euo pipefail

head="${1:?head branch}"
base="${2:?base branch}"
work='^(feature|fix|docs|chore|refactor|perf|test|ci|claude)/[a-z0-9][a-z0-9._-]*(/[a-z0-9._-]+)*$'

if [[ "$base" == develop && "$head" =~ $work ]]; then
  echo "${head%%/*}"
elif [[ "$base" == main && "$head" =~ ^hotfix/[a-z0-9][a-z0-9._-]*$ ]]; then
  echo hotfix
elif [[ "$base" == main && "$head" == develop ]]; then
  echo release
elif [[ "$base" == develop && "$head" == main ]]; then
  echo sync
else
  {
    echo "'$head' -> '$base' is not allowed."
    echo "Work branches (feature/, fix/, docs/, chore/, refactor/, perf/, test/, ci/, claude/ + kebab-case topic) target develop."
    echo "hotfix/<topic> targets main. Only develop -> main (release) and main -> develop (sync) cross between the two."
  } >&2
  exit 1
fi
