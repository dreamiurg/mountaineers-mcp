#!/bin/bash
# Simulated Claude Code session with mountaineers-mcp
# Recreates realistic Claude Code UI for README demo GIF
# Real data from mountaineers.org with sanitized personal information

set -e

# ── Colors ──
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
ORANGE='\033[38;5;208m'

# ── Timing helpers ──
pause() { sleep "${1:-0.5}"; }
line() { echo -e "$1"; pause "${2:-0.12}"; }
type_char() {
    local text="$1" delay="${2:-0.04}"
    for (( i=0; i<${#text}; i++ )); do
        printf '%s' "${text:$i:1}"
        sleep "$delay"
    done
}

# ── Start ──
clear
pause 0.5

# ═══════════════════════════════════════════════════════════════════════════════
# QUERY 1: Trip Reports (public data — real authors, real routes)
# ═══════════════════════════════════════════════════════════════════════════════

echo -ne "${MAGENTA}>${RESET} "
type_char "Show me recent trip reports for Mount Rainier climbing routes" 0.035
pause 0.4
echo ""
echo ""

# Tool call
line "${GRAY}  ${CYAN}search_trip_reports${RESET}${GRAY} (query: \"Mount Rainier\", activity_type: \"Climbing\")${RESET}" 0.05
echo ""
pause 1.5

# Response
line "  Found ${BOLD}97${RESET} Mount Rainier climbing trip reports. Here are the most recent:" 0.08
echo ""
line "  ${BOLD}Route                       Date       Author           Result${RESET}" 0.04
line "  ${DIM}───────────────────────────────────────────────────────────────────${RESET}" 0.04
line "  Fuhrer Finger              May 2025   Cameron Derwin   ${GREEN}Summit${RESET}" 0.1
line "  Emmons-Winthrop Glacier    Jul 2025   Joshua Walther   ${GREEN}Summit${RESET}" 0.1
line "  Disappointment Cleaver     Jul 2018   Dennis Eller     ${GREEN}Summit${RESET}" 0.1
line "  Ingraham Direct            May 2018   Carolyn Graham   ${GREEN}Summit${RESET}" 0.1
line "  Kautz Glacier              Aug 2017   Craig Taylor     ${GREEN}Summit${RESET}" 0.1
echo ""
line "  ${DIM}Latest conditions (May 2025):${RESET}" 0.05
line "  Ingraham Direct fully wanded from Camp Muir to summit." 0.05
line "  Fuhrer Finger in ${GREEN}phenomenal condition${RESET} — no open cracks." 0.05
line "  Upper Nisqually has one critical snow bridge to monitor." 0.05
echo ""
pause 5.0

# ═══════════════════════════════════════════════════════════════════════════════
# QUERY 2: My Activities (sanitized — real course names, fake leaders)
# ═══════════════════════════════════════════════════════════════════════════════

echo -ne "${MAGENTA}>${RESET} "
type_char "What am I signed up for this spring?" 0.04
pause 0.4
echo ""
echo ""

# Tool call
line "${GRAY}  ${CYAN}get_my_activities${RESET}${GRAY} (date_from: \"2026-02-01\", date_to: \"2026-03-31\")${RESET}" 0.05
echo ""
pause 1.2

# Response (sanitized personal schedule with real course names)
line "  You have ${BOLD}4 upcoming activities${RESET} this spring:" 0.08
echo ""
line "  ${YELLOW}Feb  7${RESET}  Field Trip: Mount Si Main Trail           ${CYAN}Instructor${RESET}" 0.12
line "  ${YELLOW}Feb 19${RESET}  Practice Session: Seattle Program Center   ${CYAN}Instructor${RESET}" 0.12
line "  ${YELLOW}Mar 10${RESET}  Intermediate Glacier Climbing Lecture      ${BLUE}Student${RESET}" 0.12
line "  ${YELLOW}Mar 28${RESET}  Climbing Conditioner: Mt Washington        ${GREEN}Lead${RESET}" 0.12
echo ""
line "  You're ${BOLD}leading 3${RESET} of these. Next up is the Mount Si field trip" 0.04
line "  this Saturday! The glacier climbing lecture on Mar 10 starts" 0.04
line "  your Intermediate course." 0.04
echo ""
pause 5.0

# ═══════════════════════════════════════════════════════════════════════════════
# QUERY 3: Roster (sanitized — all names replaced)
# ═══════════════════════════════════════════════════════════════════════════════

echo -ne "${MAGENTA}>${RESET} "
type_char "Who's signed up for the Aurora Peak winter scramble on Feb 14?" 0.035
pause 0.4
echo ""
echo ""

# Two tool calls (search then roster)
line "${GRAY}  ${CYAN}search_activities${RESET}${GRAY} (query: \"Aurora Peak\", open_only: true)${RESET}" 0.05
pause 0.6
line "${GRAY}  ${CYAN}get_activity_roster${RESET}${GRAY} (winter-scramble-aurora-peak-4)${RESET}" 0.05
echo ""
pause 1.2

# Response (sanitized names)
line "  ${BOLD}Winter Scramble - Aurora Peak${RESET}" 0.08
line "  ${DIM}Feb 14, 2026 | Seattle Branch | ~9 mi, ~5000' gain${RESET}" 0.05
echo ""
line "  ${BOLD}Team (7 members):${RESET}" 0.08
line "  ${YELLOW}*${RESET} Sarah Chen               ${DIM}Primary Leader${RESET}" 0.1
line "    Maya Thompson            ${DIM}Participant${RESET}" 0.1
line "    Jordan Park              ${DIM}Participant${RESET}" 0.1
line "    Chris Nakamura           ${DIM}Participant${RESET}" 0.1
line "    Emma Petrov              ${DIM}Participant${RESET}" 0.1
line "    Ryan Kowalski            ${DIM}Participant${RESET}" 0.1
line "    Alex Rivera              ${DIM}Participant${RESET}" 0.1
echo ""
line "  A Valentine's Day scramble! Strenuous winter route requiring" 0.04
line "  snowshoes and strong route-finding skills." 0.04
line "  Registration closes Feb 12." 0.04
echo ""
pause 5.0
