#!/usr/bin/env python3
"""Push fully fleshed Miranda conversation flow + agent config to Retell.

Booking lives on the MAIN flow (no local component). Components have an
internal Begin node; Retell sim was jumping Ask Name → begin and going silent.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from pathlib import Path

ENV_PATH = Path("/home/x0bi3/websites/cbdev/.env")
AGENT_ID = "agent_d00e6b3c1a8aa5c7d5998bb30c"
FLOW_ID = "conversation_flow_8d466af9a13a"
BRIDGE = "https://admin.creativebuilds.dev/api/retell"
TRANSFER = "+16083440203"


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for line in ENV_PATH.read_text().splitlines():
        if not line.strip() or line.strip().startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def api(method: str, path: str, body: dict | None, key: str):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        "https://api.retellai.com" + path,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as res:
            raw = res.read().decode() or "{}"
            return res.status, json.loads(raw)
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        raise SystemExit(f"{method} {path} -> {e.code}: {err[:2000]}") from e


GLOBAL_PROMPT = """# Identity
You are Miranda, Client Relations for CreativeBuilds — Ryan Baldwin's independent software studio in Wisconsin.
You are the warm, competent front door: a sharp studio receptionist who likes her job.
You answer questions, help callers feel understood, and recommend a fit when it's real.
You are Ryan's virtual assistant — say that once in the greeting, then move on.
Never call yourself an A.I., an artificial intelligence, or a bot. Prefer "virtual assistant" or just Miranda.

Tagline: "You talk to me. I build it. No middlemen."

Current time: {{current_time}}

# Role (receptionist first, soft-sell second)
- Answer the call. Clarify what they need. Find a win/win.
- The ONLY hard CTA on the phone is booking a free Intro / Discovery Call with Ryan (or take a message / warm-transfer).
- Never push Blitz, retainers, or invented packages on the phone.
- Soft-sell tone: "if we're a good fit" / "see whether Ryan's the right builder for you" — not closing a deal.
- When their industry/need is clear, use ONE short example from the bank below, then offer the Intro Call. Do not stack pitches.

# Personality
- Friendly, clear, calm. Short sentences.
- One question per turn. Never stack questions.
- Wisconsin-honest. No corporate filler, no emoji storms, no fake "our team of experts."
- Never invent pricing guarantees, timelines, legal advice, ROI, or technical promises Ryan has not published.
- Never invent fake portfolio client names. Examples are kinds of work Ryan builds, not named case studies.

# Phone-call recovery (critical — do NOT blindly repeat your last line)
Phone audio is messy: cutouts, talking over each other, latency, volume swings, ASR mistakes.
- Empty / garbled / "what?" / "huh?" / "didn't catch that" → "Sorry — you cut out. Could you say that again?"
- Partial phrase heard → "I think you said … — is that right?"
- They ask to repeat times / options / a question → restate THAT content only (e.g. re-read open slots), not a prior confirmation script.
- They talk over you → stop, answer their latest ask, one question only.
- "hold on" / "one moment" / "please wait" → NO_RESPONSE_NEEDED.
- Never invent data not provided by the caller or a tool result.
- Always speak times in Central Time.
- Confirm emails once in natural speech ("name at domain dot com"). Do NOT spell letter-by-letter unless asked or unclear.
- Confirm phones by reading the number once (or last four of {{user_number}} when using caller ID).

# Compatible clients & example bank
Best fit: local shops, service companies, founders, and operators who want to work directly with Ryan (WI + remote nationwide).

When you recognize a need, pick the closest example (one sentence), then soft-offer Intro Call:
- Websites / presence: local retail storefront; plumber/salon/contractor site; founder landing page for a new offer
- Commerce-ish: product catalog + inquiry/checkout path; appointment-heavy shop; "look us up → walk in or call" local store
- Custom web apps: replace spreadsheet ops; client/staff portal; booking + admin dashboard
- Mobile apps: field-team checklist app; customer companion app; marketing team field tools
- Automations: greenhouse/grow ops (watering, lighting, schedules, alerts); lead form → CRM/email; invoice/reminder glue between tools
- Maintenance: existing site cleanup; small ongoing fixes after launch

Example shape: "We actually do a lot with local storefront sites — a clear website can send people straight to your shop or booking link. Want me to set a free Intro Call with Ryan to see if we're the right fit?"

If unclear website vs app vs automation: ask ONE clarifying question before pitching.

# Pricing
- Never invent a custom project quote on the phone.
- Soft-sell: CreativeBuilds stays competitive for scope; published ranges at creativebuilds.dev/pricing; free Intro Call is the honest way to scope.
- Blitz Call ($20 / 30 min) is website-only at /book — do NOT book on the phone.

# Booking truth (critical)
- You are NOT booked until the `book_intro_call` tool returns success.
- Never say "you're all set", "you're booked", or "Ryan will confirm" before that tool succeeds.
- Collecting a name/email/phone is NOT a booking.
- Capture a one-line project reason before checking the calendar so Ryan knows why he's calling them back.

# Facts you may use
- Studio: CreativeBuilds · Owner: Ryan Baldwin · Wisconsin, remote nationwide
- Hours: Mon–Fri, 6 AM–8 PM Central
- Studio phone: (608) 387-8444 · Email: hello@creativebuilds.dev · Site: https://www.creativebuilds.dev
- Services: business websites & landing pages; custom web apps; mobile apps (iOS/Android); integrations & automations; consulting/maintenance
- Free Intro Call / Discovery: 30 minutes with Ryan — this is what you book on the phone
- Other helpful pages: /pricing, /service-audits (free Service Audits), /inquiry
- Callback promise when taking a message: within 12 business hours

# Guardrails
- Only book the free Intro Call via tools.
- If they ask for Ryan / a human / a real person: escalate then warm-transfer.
- If transfer fails: take a message.
"""

GENERAL_INQUIRY = """Answer questions about CreativeBuilds briefly — phone receptionist, not a brochure.

# About the studio
- Ryan Baldwin's independent software studio (Wisconsin). Remote nationwide.
- You talk to Ryan; he builds it. No agency handoffs.
- Services: websites, custom web apps, mobile apps, automations/integrations, maintenance.
- Hours: Mon–Fri 6 AM–8 PM Central. hello@creativebuilds.dev · creativebuilds.dev · (608) 387-8444
- Free Intro Call (Discovery): 30 min with Ryan — soft-offer when there's a real fit.
- Blitz Call ($20/30 min): website only — send them to creativebuilds.dev/book.
- Free Service Audits: free automated website presence check at /service-audits if they prefer not to talk yet.
- Pricing depends on scope — point to /pricing; never invent a custom quote; soft-sell competitive + Intro Call.

# Fit examples (use one when relevant)
- Retail / store: "We specialize in clear local business sites — a good website can push traffic and calls to your store."
- Greenhouse / ops: "Ryan also builds automations — for example grow ops that handle schedules, alerts, and equipment."
- Spreadsheet / portal: "If you're outgrowing spreadsheets, a simple web app or portal is right in our wheelhouse."
- Field / mobile: "We build mobile tools for field teams and customer-facing apps too."
Then: "Should I get a free Intro Call with Ryan on the calendar to see if we're the right fit?"

# Handling intents
- Unsure what they need: ask if it's mainly a website, an app, or an automation (one question).
- Ready to talk / book / discovery / consultation: move to booking.
- Quote / "how much": depends on scope → /pricing + offer Intro Call.
- Blitz: website only.
- Off-topic: politely redirect.

Stay on this step until they want to book the Intro Call, want Ryan, or are done.
"""

ASK_NAME = """Ask for their full name only. One short question.
When they give a name, acknowledge briefly (e.g. "Thanks, Ron.") — then stop.
Do NOT ask for email or phone yet. Do NOT call any tools. Do NOT say anything is booked.
"""

ASK_EMAIL = """Ask for their email address only.
When they give it, confirm ONCE in natural speech ("ron at example dot com — is that right?").
Do NOT spell letter-by-letter unless they ask or it was unclear.
After they confirm yes, acknowledge briefly — then stop.
Do NOT ask for phone yet. Do NOT call any tools. Do NOT say booked.
"""

ASK_PHONE = """Collect a callback phone. You have NOT booked anything yet. Do NOT call any tools yet.

If {{user_number}} looks like a real phone number:
- Ask: "Is the number you're calling from the best one for Ryan to reach you?"
- If they say yes/yeah/correct/this number OR they only confirm last digits of {{user_number}}: acknowledge and stop. The callback is already {{user_number}} — do NOT ask them to re-dictate the full number.
- If they ask "is it …?" about last digits of {{user_number}}: confirm those last digits, then ask once if Ryan should use this number; on yes, stop.

If they want a different number, or {{user_number}} is empty (web/chat test):
- Ask them to give the full 10-digit number, confirm it once, then acknowledge and stop.

Do NOT say they are booked or offer times — next we capture why they're calling, then check the calendar.
"""

COLLECT_PROJECT_NOTE = """Ask ONE short question so Ryan knows why he's talking to them:
what they're hoping for — website, app, automation, or maintenance — plus a one-sentence idea if they have one.

Examples: "Quick one — is this mainly a website, an app, or an automation?" then if needed "Anything specific Ryan should know going in?"

They may skip ("not sure", "just exploring") — that is fine. Acknowledge and stop.
Do NOT say anything is booked. Do NOT offer times yet. Do NOT call tools.
"""

OFFER_SLOTS = """{{available_slots}} has open Intro Call slots from the calendar check.

Offer the first 2–3 times in Central Time (e.g. "Friday at 10 AM, Monday at 2 PM, or Tuesday at 9 AM Central"). Ask which works.
Do NOT call tools. Do NOT say anything is booked yet.
If none work or they ask for a human/Ryan, say so briefly.
"""

RESTATE_SLOTS = """The caller missed the times or asked you to repeat them.

Re-read ONLY the same first 2–3 open times from {{available_slots}} in Central Time. Ask which works.
Do NOT jump into booking confirmation. Do NOT call tools. Do NOT say anything is booked.
"""


def auth_headers(secret: str) -> dict:
    return {"Authorization": f"Bearer {secret}"}


def edge(eid: str, dest: str, prompt: str) -> dict:
    return {
        "id": eid,
        "destination_node_id": dest,
        "transition_condition": {"type": "prompt", "prompt": prompt},
    }


def build_flow(secret: str) -> dict:
    check_slots = {
        "headers": auth_headers(secret),
        "execution_message_type": "static_text",
        "method": "GET",
        "description": "Returns available free Intro Call (Discovery) slots on Ryan's Cal.diy calendar.",
        "type": "custom",
        "url": f"{BRIDGE}/slots?limit=8",
        "tool_id": "check_slots_tool",
        "execution_message_description": "One moment — checking Ryan's calendar.",
        "timeout_ms": 15000,
        "speak_after_execution": False,
        "name": "check_slots",
        "response_variables": {"available_slots": "slots"},
        "speak_during_execution": True,
    }
    book_intro = {
        "headers": auth_headers(secret),
        "parameter_type": "json",
        "execution_message_type": "static_text",
        "method": "POST",
        "description": "Books the free 30-minute Intro Call. Pass name, email, phone, and start (ISO from check_slots).",
        "type": "custom",
        "url": f"{BRIDGE}/book",
        "tool_id": "book_intro_call_tool",
        "args_at_root": True,
        "execution_message_description": "One moment — booking that Intro Call now.",
        "timeout_ms": 20000,
        "speak_after_execution": False,
        "name": "book_intro_call",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Caller's full name. Use {{caller_name}}.",
                },
                "email": {
                    "type": "string",
                    "description": "Caller's email. Use {{caller_email}}.",
                },
                "phone": {
                    "type": "string",
                    "description": "Callback phone with at least 10 digits. Prefer {{caller_phone}}; never last-4/last-7 only.",
                },
                "fromNumber": {
                    "type": "string",
                    "description": "Inbound caller ID. Always pass {{user_number}} when present.",
                },
                "start": {
                    "type": "string",
                    "description": "ISO start from chosen slot. Use {{chosen_slot_start}}.",
                },
                "notes": {
                    "type": "string",
                    "description": "Optional one-line project interest for Ryan.",
                },
            },
            "required": ["name", "email", "phone", "start"],
        },
        "speak_during_execution": True,
    }
    escalate = {
        "headers": auth_headers(secret),
        "parameter_type": "json",
        "method": "POST",
        "description": "Email Ryan that the caller needs a human. Call before warm transfer.",
        "type": "custom",
        "url": f"{BRIDGE}/escalate",
        "tool_id": "escalate_to_ryan_tool",
        "args_at_root": True,
        "timeout_ms": 15000,
        "speak_after_execution": False,
        "name": "escalate_to_ryan",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Caller name if known"},
                "phone": {"type": "string", "description": "Caller phone if known"},
                "email": {"type": "string", "description": "Caller email if known"},
                "reason": {
                    "type": "string",
                    "description": "Why escalating (asked for Ryan, booking failed, etc.)",
                },
                "transcript": {
                    "type": "string",
                    "description": "Short summary of the call so far",
                },
            },
            "required": ["reason"],
        },
        "speak_during_execution": False,
    }

    nodes = [
        {
            "id": "greeting",
            "type": "conversation",
            "name": "Greeting",
            "instruction": {
                "type": "static_text",
                "text": "Hi, thanks for calling CreativeBuilds. This is Miranda, Ryan's virtual assistant — how can I help you today?",
            },
            "edges": [],
            "always_edge": {
                "id": "edge_greet_done",
                "destination_node_id": "general_inquiry",
                "transition_condition": {"type": "prompt", "prompt": "Always"},
            },
            "display_position": {"x": 0, "y": 280},
        },
        {
            "id": "general_inquiry",
            "type": "conversation",
            "name": "General Inquiry",
            "instruction": {"type": "prompt", "text": GENERAL_INQUIRY},
            "edges": [
                edge(
                    "edge_wants_booking",
                    "ask_name",
                    "Caller wants to schedule the free Intro Call, Discovery Call, consultation, or meeting with Ryan",
                ),
                edge(
                    "edge_done_faq",
                    "end_call",
                    "Caller is finished and does not want to book or speak with Ryan",
                ),
            ],
            "display_position": {"x": 520, "y": 280},
        },
        # --- Booking path (flattened; no component) ---
        {
            "id": "ask_name",
            "type": "conversation",
            "name": "Ask Name",
            "instruction": {"type": "prompt", "text": ASK_NAME},
            "edges": [
                edge(
                    "edge_name_given",
                    "ask_email",
                    "Caller stated their name (first name alone or full name is fine)",
                ),
                edge(
                    "edge_name_refused",
                    "booking_failed_soft",
                    "Caller refuses to give a name or asks for a human/Ryan",
                ),
            ],
            "finetune_transition_examples": [
                {
                    "id": "ft_name_ron",
                    "transcript": [
                        {"role": "agent", "content": "Great. Can I get your full name, please?"},
                        {"role": "user", "content": "ron sullican"},
                    ],
                    "destination_node_id": "ask_email",
                },
                {
                    "id": "ft_name_jane",
                    "transcript": [
                        {"role": "agent", "content": "Great. Can I get your full name, please?"},
                        {"role": "user", "content": "Jane Doe"},
                    ],
                    "destination_node_id": "ask_email",
                },
            ],
            "display_position": {"x": 1040, "y": 280},
        },
        {
            "id": "ask_email",
            "type": "conversation",
            "name": "Ask Email",
            "instruction": {"type": "prompt", "text": ASK_EMAIL},
            "edges": [
                edge(
                    "edge_email_ok",
                    "ask_phone",
                    "Caller provided an email and confirmed it is correct",
                ),
                edge(
                    "edge_email_refused",
                    "booking_failed_soft",
                    "Caller refuses email or asks for a human/Ryan",
                ),
            ],
            "display_position": {"x": 1560, "y": 280},
        },
        {
            "id": "ask_phone",
            "type": "conversation",
            "name": "Ask Phone",
            "instruction": {"type": "prompt", "text": ASK_PHONE},
            "edges": [
                edge(
                    "edge_phone_ok",
                    "save_contact",
                    "Caller confirmed caller ID as callback, or gave and confirmed a phone number",
                ),
                edge(
                    "edge_phone_refused",
                    "booking_failed_soft",
                    "Caller refuses phone or asks for a human/Ryan",
                ),
            ],
            "display_position": {"x": 2080, "y": 280},
        },
        {
            # Silent extract-on-entry node — auto-advances (subagent extract waits for another user turn).
            "id": "save_contact",
            "type": "extract_dynamic_variables",
            "name": "Save Contact",
            "variables": [
                {
                    "type": "string",
                    "name": "caller_name",
                    "description": "Full name the caller gave",
                    "examples": ["Ron Sullivan II", "Jane Doe"],
                },
                {
                    "type": "string",
                    "name": "caller_email",
                    "description": "Confirmed email address",
                    "examples": ["ronmail@mail.com"],
                },
                {
                    "type": "string",
                    "name": "caller_phone",
                    "description": (
                        "Full callback phone with country/area code (10+ digits). "
                        "If they confirmed the inbound caller ID (yes / this number / confirmed last digits of {{user_number}}), "
                        "set this EXACTLY to {{user_number}} (e.g. +16083440203). "
                        "NEVER store only last-4 or last-7 digits. "
                        "Only use a spoken number when they gave a DIFFERENT full callback number. Never yes/no."
                    ),
                    "examples": ["+16083440203", "6085551212", "+16085551212"],
                },
            ],
            "edges": [
                edge("edge_contact_saved", "collect_project_note", "Always"),
            ],
            "display_position": {"x": 2600, "y": 280},
        },
        {
            "id": "collect_project_note",
            "type": "conversation",
            "name": "Collect Project Note",
            "instruction": {"type": "prompt", "text": COLLECT_PROJECT_NOTE},
            "edges": [
                edge(
                    "edge_note_done",
                    "save_project_note",
                    "Caller answered the project question, said they are not sure, or want to skip",
                ),
            ],
            "display_position": {"x": 2860, "y": 280},
        },
        {
            "id": "save_project_note",
            "type": "extract_dynamic_variables",
            "name": "Save Project Note",
            "variables": [
                {
                    "type": "string",
                    "name": "project_note",
                    "description": "One-line reason for the call / project type for Ryan (website, app, automation, maintenance, or exploring). Keep short.",
                    "examples": [
                        "Local retail website to drive store traffic",
                        "Greenhouse automation schedules and alerts",
                        "Not sure yet — exploring Intro Call",
                    ],
                },
            ],
            "edges": [
                edge("edge_note_saved", "check_availability", "Always"),
            ],
            "display_position": {"x": 2990, "y": 280},
        },
        {
            "id": "check_availability",
            "type": "function",
            "name": "Check Availability",
            "tool_type": "local",
            "tool_id": "check_slots_tool",
            "wait_for_result": True,
            "speak_during_execution": True,
            "edges": [
                edge(
                    "edge_slots_found",
                    "offer_slots",
                    "One or more available times were returned",
                )
            ],
            "else_edge": {
                "id": "edge_slots_else",
                "destination_node_id": "booking_failed_soft",
                "transition_condition": {"type": "prompt", "prompt": "Else"},
            },
            "display_position": {"x": 3120, "y": 280},
        },
        {
            "id": "offer_slots",
            "type": "conversation",
            "name": "Offer Slots",
            "instruction": {"type": "prompt", "text": OFFER_SLOTS},
            "edges": [
                edge(
                    "edge_slot_chosen",
                    "save_chosen_slot",
                    "Caller picked one of the offered times",
                ),
                edge(
                    "edge_slot_repeat",
                    "restate_slots",
                    "Caller asks to hear the available times again, didn't catch them, or asks what the options were",
                ),
                edge(
                    "edge_slot_none",
                    "booking_failed_soft",
                    "No offered times work, or caller asks for human/Ryan",
                ),
            ],
            "finetune_transition_examples": [
                {
                    "id": "ft_times_again",
                    "transcript": [
                        {
                            "role": "agent",
                            "content": "Friday at 7 AM, 7:30 AM, or 8 AM Central. Do any of those work?",
                        },
                        {"role": "user", "content": "What were the times again?"},
                    ],
                    "destination_node_id": "restate_slots",
                },
                {
                    "id": "ft_pick_eight",
                    "transcript": [
                        {
                            "role": "agent",
                            "content": "Friday at 7 AM, 7:30 AM, or 8 AM Central. Do any of those work?",
                        },
                        {"role": "user", "content": "Eight AM is fine."},
                    ],
                    "destination_node_id": "save_chosen_slot",
                },
            ],
            "display_position": {"x": 3640, "y": 120},
        },
        {
            "id": "restate_slots",
            "type": "conversation",
            "name": "Restate Slots",
            "instruction": {"type": "prompt", "text": RESTATE_SLOTS},
            "edges": [
                edge(
                    "edge_restate_chosen",
                    "save_chosen_slot",
                    "Caller picked one of the offered times",
                ),
                edge(
                    "edge_restate_again",
                    "offer_slots",
                    "Caller asks to hear the times again or still didn't catch them",
                ),
                edge(
                    "edge_restate_none",
                    "booking_failed_soft",
                    "No offered times work, or caller asks for human/Ryan",
                ),
            ],
            "display_position": {"x": 3640, "y": 320},
        },
        {
            "id": "save_chosen_slot",
            "type": "extract_dynamic_variables",
            "name": "Save Chosen Slot",
            "variables": [
                {
                    "type": "string",
                    "name": "chosen_slot_start",
                    "description": "Exact ISO start timestamp from the available_slots list for the time the caller picked",
                    "examples": ["2026-07-17T12:00:00.000Z"],
                },
                {
                    "type": "string",
                    "name": "chosen_slot_label",
                    "description": "Short Central Time label for the chosen slot",
                    "examples": ["Friday at 7 AM Central", "Fri, Jul 17, 7:00 AM"],
                },
            ],
            "edges": [
                edge("edge_slot_saved", "confirm_booking_details", "Always"),
            ],
            "display_position": {"x": 4160, "y": 120},
        },
        {
            "id": "confirm_booking_details",
            "type": "conversation",
            "name": "Confirm Details",
            "instruction": {
                "type": "prompt",
                "text": "Read back before booking: {{caller_name}}, {{caller_email}}, {{caller_phone}}, {{chosen_slot_label}}. Say this is the free 30-minute Intro Call with Ryan. Ask them to confirm.",
            },
            "edges": [
                edge(
                    "edge_details_ok",
                    "book_intro_call_fn",
                    "Caller confirms details are correct",
                ),
                edge(
                    "edge_fix_contact",
                    "ask_name",
                    "Caller wants to fix name, email, or phone",
                ),
                edge(
                    "edge_fix_time",
                    "offer_slots",
                    "Caller wants a different time",
                ),
            ],
            "display_position": {"x": 4680, "y": 280},
        },
        {
            "id": "book_intro_call_fn",
            "type": "function",
            "name": "Book Intro Call",
            "tool_type": "local",
            "tool_id": "book_intro_call_tool",
            "wait_for_result": True,
            "speak_during_execution": True,
            "instruction": {
                "type": "static_text",
                "text": "One moment — booking that Intro Call now.",
            },
            "parameter_values": {
                "name": "{{caller_name}}",
                "email": "{{caller_email}}",
                "phone": "{{caller_phone}}",
                "fromNumber": "{{user_number}}",
                "start": "{{chosen_slot_start}}",
                "notes": "{{project_note}}",
            },
            "edges": [
                edge(
                    "edge_booking_success",
                    "booking_confirmed",
                    "Booking created successfully",
                )
            ],
            "else_edge": {
                "id": "edge_booking_fail",
                "destination_node_id": "booking_failed_soft",
                "transition_condition": {"type": "prompt", "prompt": "Else"},
            },
            "display_position": {"x": 5200, "y": 280},
        },
        {
            "id": "booking_confirmed",
            "type": "conversation",
            "name": "Booking Confirmed",
            "instruction": {
                "type": "prompt",
                "text": "The book_intro_call tool just succeeded. NOW confirm: free Intro Call with Ryan at {{chosen_slot_label}} Central, confirmation email to {{caller_email}}. Do not claim booked before this node.",
            },
            "edges": [],
            "always_edge": {
                "id": "edge_confirmed_next",
                "destination_node_id": "post_booking",
                "transition_condition": {"type": "prompt", "prompt": "Always"},
            },
            "display_position": {"x": 5720, "y": 40},
        },
        {
            "id": "booking_failed_soft",
            "type": "conversation",
            "name": "Booking Incomplete",
            "instruction": {
                "type": "prompt",
                "text": "We couldn't finish booking just now. Apologize briefly. Offer to try again, take a message for Ryan, or transfer if they want a person. Do not pretend a booking was made.",
            },
            "edges": [
                edge(
                    "edge_retry_book",
                    "ask_phone",
                    "Caller wants to try booking again — reconfirm callback phone, then continue (do not pretend prior booking succeeded)",
                ),
                edge(
                    "edge_fail_done",
                    "end_call",
                    "Caller is done and does not want to retry or speak to Ryan",
                ),
            ],
            "display_position": {"x": 5200, "y": 560},
        },
        {
            "id": "post_booking",
            "type": "conversation",
            "name": "Anything Else",
            "instruction": {
                "type": "prompt",
                "text": "The Intro Call is already booked. Ask if there's anything else — if not, thank them and wrap up. Do not re-collect contact info.",
            },
            "edges": [
                edge(
                    "edge_post_done",
                    "end_call",
                    "Caller has no more questions",
                ),
                edge(
                    "edge_post_more_faq",
                    "general_inquiry",
                    "Caller has another question about CreativeBuilds that is not a rebooking",
                ),
            ],
            "display_position": {"x": 6240, "y": 40},
        },
        {
            "id": "escalate_to_ryan",
            "type": "function",
            "name": "Escalate to Ryan",
            "tool_type": "local",
            "tool_id": "escalate_to_ryan_tool",
            "wait_for_result": True,
            "speak_during_execution": True,
            "instruction": {
                "type": "prompt",
                "text": "Briefly say you're connecting them with Ryan now.",
            },
            "global_node_setting": {
                "condition": "Caller asks to speak with a human, Ryan, or a real person at any point."
            },
            "edges": [
                edge(
                    "edge_escalated",
                    "transfer_to_ryan",
                    "Escalation step finished (success or failure)",
                )
            ],
            "display_position": {"x": 1560, "y": 720},
        },
        {
            "id": "transfer_to_ryan",
            "type": "transfer_call",
            "name": "Transfer to Ryan",
            "speak_during_execution": True,
            "instruction": {
                "type": "prompt",
                "text": "Tell the caller you're transferring them to Ryan now.",
            },
            "transfer_destination": {"type": "predefined", "number": TRANSFER},
            "transfer_option": {
                "type": "warm_transfer",
                "enable_bridge_audio_cue": True,
                "private_handoff_option": {
                    "type": "prompt",
                    "prompt": "In 1–2 sentences for Ryan: caller name, {{project_note}} or reason for calling, and any booking or contact details collected.",
                },
            },
            "edge": {
                "id": "edge_transfer_failed",
                "destination_node_id": "take_message",
                "transition_condition": {"type": "prompt", "prompt": "Transfer failed"},
            },
            "display_position": {"x": 2080, "y": 720},
        },
        {
            "id": "take_message",
            "type": "conversation",
            "name": "Take a Message",
            "instruction": {
                "type": "prompt",
                "text": "Transfer didn't go through. Apologize briefly. Collect name, best callback number, and a short reason — confirm anything already known instead of re-asking.",
            },
            "edges": [],
            "always_edge": {
                "id": "edge_message_done",
                "destination_node_id": "end_call_after_message",
                "transition_condition": {"type": "prompt", "prompt": "Always"},
            },
            "display_position": {"x": 2600, "y": 720},
        },
        {
            "id": "end_call_after_message",
            "type": "end",
            "name": "End After Message",
            "speak_during_execution": True,
            "instruction": {
                "type": "prompt",
                "text": "Confirm you have the message and Ryan will call back within 12 business hours. Thank them and end the call.",
            },
            "display_position": {"x": 3120, "y": 720},
        },
        {
            "id": "end_call",
            "type": "end",
            "name": "End Call",
            "speak_during_execution": True,
            "instruction": {
                "type": "prompt",
                "text": "Thank them for calling CreativeBuilds and end warmly.",
            },
            "display_position": {"x": 520, "y": 720},
        },
    ]

    return {
        "global_prompt": GLOBAL_PROMPT,
        "start_speaker": "agent",
        "start_node_id": "greeting",
        "model_choice": {"type": "cascading", "model": "gpt-4.1"},
        "tool_call_strict_mode": True,
        "kb_config": {"top_k": 3, "filter_score": 0.6},
        "tools": [escalate, check_slots, book_intro],
        "nodes": nodes,
        "components": [],
    }


def upsert_env(key: str, value: str) -> None:
    lines = ENV_PATH.read_text().splitlines()
    out = []
    found = False
    for line in lines:
        if line.startswith(f"{key}="):
            out.append(f"{key}={value}")
            found = True
        else:
            out.append(line)
    if not found:
        out.append(f"{key}={value}")
    ENV_PATH.write_text("\n".join(out) + "\n")


def main() -> None:
    env = load_env()
    key = env.get("RETELL_API_KEY") or ""
    secret = env.get("RETELL_BRIDGE_SECRET") or ""
    if not key:
        raise SystemExit("RETELL_API_KEY missing in cbdev .env")
    if not secret:
        raise SystemExit("RETELL_BRIDGE_SECRET missing in cbdev .env")

    flow_body = build_flow(secret)
    status, flow = api("PATCH", f"/update-conversation-flow/{FLOW_ID}", flow_body, key)
    print("flow update", status, flow.get("conversation_flow_id"), "v", flow.get("version"))
    print(
        "nodes:",
        [n.get("id") for n in flow.get("nodes") or []],
    )
    print("components:", flow.get("components"))

    agent_body = {
        "agent_name": "Miranda",
        "voice_id": "retell-Tamsin",
        "language": "en-US",
        "response_engine": {
            "type": "conversation-flow",
            "conversation_flow_id": FLOW_ID,
        },
        "interruption_sensitivity": 0.65,
        "voice_temperature": 0.9,
        "voice_speed": 1.0,
        "responsiveness": 0.85,
        "enable_backchannel": True,
        "end_call_after_silence_ms": 45000,
        "max_call_duration_ms": 900000,
        "begin_message": None,
        "webhook_url": None,
    }
    try:
        status, agent = api("PATCH", f"/update-agent/{AGENT_ID}", agent_body, key)
    except SystemExit as e:
        print("retry slim agent body:", e)
        slim = {
            "agent_name": "Miranda",
            "voice_id": "retell-Tamsin",
            "language": "en-US",
            "response_engine": {
                "type": "conversation-flow",
                "conversation_flow_id": FLOW_ID,
            },
        }
        status, agent = api("PATCH", f"/update-agent/{AGENT_ID}", slim, key)
    print("agent update", status, agent.get("agent_name"), agent.get("agent_id"))

    try:
        status, pub = api("POST", f"/publish-agent/{AGENT_ID}", {}, key)
        print("publish", status, pub if isinstance(pub, dict) else pub)
    except SystemExit as e:
        print("publish skipped/failed:", str(e)[:400])

    upsert_env("RETELL_AGENT_ID", AGENT_ID)
    upsert_env("RETELL_CONVERSATION_FLOW_ID", FLOW_ID)
    upsert_env("CREATIVEBUILDS_PUBLIC_PHONE", "(608) 387-8444")
    upsert_env("RETELL_PHONE_NUMBER", "+16083878444")
    print("env ids saved")
    print("DONE Miranda agent ready:", AGENT_ID)


if __name__ == "__main__":
    main()
