#!/usr/bin/env python3
"""
Midas Design System Generator (5 Pages)
Generates pixel-perfect, human-readable, high-fidelity Design System components
with explicit relative coordinates, component sets, variants, and design tokens.
"""
import json
import uuid
import os

def uid(prefix="n"):
    return f"{prefix}_{uuid.uuid4().hex[:10]}"

def node(node_type, **props):
    w_val = props.pop("w", 400 if node_type == "frame" else (120 if node_type == "text" else 160))
    h_val = props.pop("h", 300 if node_type == "frame" else (20 if node_type == "text" else 100))
    fill_val = props.pop("fill", "#ffffff" if node_type == "frame" else ("#0f172a" if node_type == "text" else "#0058CA"))
    clip_val = props.pop("clip", True if node_type == "frame" else False)

    base = {
        "id": props.pop("id", uid(node_type[:3])),
        "type": node_type,
        "name": props.pop("name", node_type.capitalize()),
        "parentId": props.pop("parentId", None),
        "x": props.pop("x", 0),
        "y": props.pop("y", 0),
        "w": w_val,
        "h": h_val,
        "rotation": 0,
        "fill": fill_val,
        "fill2": "#cfe1fa",
        "fillType": "solid",
        "gradientAngle": 90,
        "fillOpacity": props.pop("fillOpacity", 1),
        "stroke": props.pop("stroke", "none"),
        "strokeWidth": props.pop("strokeWidth", 0),
        "radius": props.pop("radius", 0),
        "opacity": props.pop("opacity", 1),
        "visible": props.pop("visible", True),
        "locked": False,
        "clip": clip_val,
        "shadow": props.pop("shadow", False),
        "shadowColor": props.pop("shadowColor", "#000000"),
        "shadowOpacity": props.pop("shadowOpacity", 0.08),
        "shadowBlur": props.pop("shadowBlur", 16),
        "shadowX": 0,
        "shadowY": props.pop("shadowY", 4),
        "version": 0
    }
    if node_type == "text":
        base.update({
            "text": props.pop("text", "Text"),
            "fontFamily": "Inter",
            "fontSize": props.pop("fontSize", 14),
            "fontWeight": props.pop("fontWeight", 400),
            "fontStyle": "normal",
            "lineHeight": props.pop("lineHeight", 1.35),
            "letterSpacing": props.pop("letterSpacing", 0),
            "textAlign": props.pop("textAlign", "left"),
            "textDecoration": props.pop("textDecoration", "none"),
            "textCase": "none",
            "direction": "auto"
        })
    elif node_type == "group":
        base.update({"fill": "none"})
    elif node_type == "path":
        base.update({
            "pathW": props.pop("pathW", base["w"]),
            "pathH": props.pop("pathH", base["h"]),
            "points": props.pop("points", []),
            "closed": props.pop("closed", True)
        })
    base.update(props)
    return base

# Header builder for each page artboard
def add_page_header(nodes, parent_id, number_title, subtitle):
    # Header container
    hd = node("frame",
        parentId=parent_id,
        name="Header Section",
        x=40, y=36, w=1120, h=80,
        fill="#ffffff",
        radius=12,
        stroke="#e2e8f0",
        strokeWidth=1,
        shadow=True,
        shadowBlur=12,
        shadowOpacity=0.04
    )
    nodes.append(hd)

    # Accent pill
    nodes.append(node("frame",
        parentId=hd["id"],
        name="Category Pill",
        x=24, y=18, w=140, h=22,
        fill="#eff6ff",
        radius=9999
    ))
    nodes.append(node("text",
        parentId=hd["id"],
        name="Category Label",
        text="DESIGN SYSTEM",
        x=34, y=22, w=120, h=14,
        fontSize=10,
        fontWeight=700,
        fill="#2563eb"
    ))

    # Title
    nodes.append(node("text",
        parentId=hd["id"],
        name="Page Title",
        text=number_title,
        x=24, y=44, w=500, h=24,
        fontSize=18,
        fontWeight=700,
        fill="#0f172a"
    ))

    # Subtitle
    nodes.append(node("text",
        parentId=hd["id"],
        name="Page Subtitle",
        text=subtitle,
        x=540, y=47, w=550, h=20,
        fontSize=13,
        fontWeight=400,
        fill="#64748b",
        textAlign="right"
    ))

def build_variables():
    colors_coll_id = "coll-colors"
    spacing_coll_id = "coll-spacing"
    radius_coll_id = "coll-radius"

    collections = [
        {
            "id": colors_coll_id,
            "name": "Colors",
            "modes": [
                {"id": "mode-light", "name": "Light"},
                {"id": "mode-dark", "name": "Dark"}
            ],
            "groups": ["Primitive", "Semantic"]
        },
        {
            "id": spacing_coll_id,
            "name": "Spacing",
            "modes": [{"id": "mode-spacing", "name": "Default"}],
            "groups": []
        },
        {
            "id": radius_coll_id,
            "name": "Radius",
            "modes": [{"id": "mode-radius", "name": "Default"}],
            "groups": []
        }
    ]

    items = []

    primitives = {
        "blue-50": "#eff6ff", "blue-100": "#dbeafe", "blue-500": "#3b82f6", "blue-600": "#2563eb", "blue-700": "#1d4ed8",
        "gray-50": "#f8fafc", "gray-100": "#f1f5f9", "gray-200": "#e2e8f0", "gray-300": "#cbd5e1", "gray-400": "#94a3b8",
        "gray-500": "#64748b", "gray-600": "#475569", "gray-700": "#334155", "gray-800": "#1e293b", "gray-900": "#0f172a",
        "green-50": "#f0fdf4", "green-100": "#dcfce7", "green-500": "#22c55e", "green-600": "#16a34a", "green-700": "#15803d",
        "red-50": "#fef2f2", "red-100": "#fee2e2", "red-500": "#ef4444", "red-600": "#dc2626", "red-700": "#b91c1c",
        "amber-50": "#fffbeb", "amber-100": "#fef3c7", "amber-500": "#f59e0b", "amber-600": "#d97706", "amber-700": "#b45309",
        "white": "#ffffff", "black": "#000000"
    }

    for name, hex_val in primitives.items():
        items.append({
            "id": f"var-{name}",
            "name": f"Primitive/{name}",
            "type": "color",
            "collectionId": colors_coll_id,
            "values": {"mode-light": hex_val, "mode-dark": hex_val},
            "scopes": ["ALL_FILLS", "STROKE_COLOR"]
        })

    semantics = [
        ("bg-primary", {"mode-light": "#2563eb", "mode-dark": "#3b82f6"}),
        ("bg-primary-hover", {"mode-light": "#1d4ed8", "mode-dark": "#2563eb"}),
        ("bg-surface", {"mode-light": "#f8fafc", "mode-dark": "#0f172a"}),
        ("bg-card", {"mode-light": "#ffffff", "mode-dark": "#1e293b"}),
        ("bg-muted", {"mode-light": "#f1f5f9", "mode-dark": "#334155"}),
        ("text-primary", {"mode-light": "#0f172a", "mode-dark": "#f8fafc"}),
        ("text-secondary", {"mode-light": "#475569", "mode-dark": "#94a3b8"}),
        ("text-muted", {"mode-light": "#64748b", "mode-dark": "#64748b"}),
        ("text-inverted", {"mode-light": "#ffffff", "mode-dark": "#0f172a"}),
        ("text-error", {"mode-light": "#b91c1c", "mode-dark": "#ef4444"}),
        ("border-default", {"mode-light": "#e2e8f0", "mode-dark": "#334155"}),
        ("border-focus", {"mode-light": "#3b82f6", "mode-dark": "#60a5fa"}),
        ("status-success", {"mode-light": "#16a34a", "mode-dark": "#22c55e"}),
        ("status-warning", {"mode-light": "#d97706", "mode-dark": "#f59e0b"}),
        ("status-error", {"mode-light": "#dc2626", "mode-dark": "#ef4444"}),
    ]

    for name, modes in semantics:
        items.append({
            "id": f"var-{name}",
            "name": f"Semantic/{name}",
            "type": "color",
            "collectionId": colors_coll_id,
            "values": modes,
            "scopes": ["ALL_FILLS", "STROKE_COLOR"]
        })

    for s in [4, 8, 12, 16, 24, 32, 48]:
        items.append({
            "id": f"var-spacing-{s}",
            "name": f"spacing-{s}",
            "type": "number",
            "collectionId": spacing_coll_id,
            "values": {"mode-spacing": s},
            "scopes": ["GAP"]
        })

    for rname, rval in [("none", 0), ("sm", 4), ("md", 8), ("lg", 16), ("full", 9999)]:
        items.append({
            "id": f"var-radius-{rname}",
            "name": f"radius-{rname}",
            "type": "number",
            "collectionId": radius_coll_id,
            "values": {"mode-radius": rval},
            "scopes": ["CORNER_RADIUS"]
        })

    return {"collections": collections, "items": items}

# =============================================================================
# PAGE 1: 01 · Atoms
# =============================================================================
def build_page_atoms():
    nodes = []
    # Root Artboard
    artboard = node("frame",
        name="01 · Atoms",
        x=0, y=0, w=1200, h=1420,
        fill="#f8fafc",
        clip=False
    )
    nodes.append(artboard)
    add_page_header(nodes, artboard["id"], "01 · Atoms & UI Primitives", "Buttons (48 Variants), Links, Badges, and 24 System Icons")

    # 1.1 Buttons ComponentSet Box
    btn_section = node("frame",
        parentId=artboard["id"],
        name="Button Variants",
        x=40, y=136, w=1120, h=520,
        fill="#ffffff",
        radius=12,
        stroke="#9747ff",
        strokeWidth=1,
        strokeStyle="dash",
        strokeDash=6,
        strokeGap=4,
        componentSet=True,
        clip=False
    )
    nodes.append(btn_section)

    # Header labels inside button section
    nodes.append(node("text", parentId=btn_section["id"], name="Col Default", text="DEFAULT", x=180, y=20, w=120, h=16, fontSize=11, fontWeight=700, fill="#64748b"))
    nodes.append(node("text", parentId=btn_section["id"], name="Col Hover", text="HOVER", x=340, y=20, w=120, h=16, fontSize=11, fontWeight=700, fill="#64748b"))
    nodes.append(node("text", parentId=btn_section["id"], name="Col Disabled", text="DISABLED", x=500, y=20, w=120, h=16, fontSize=11, fontWeight=700, fill="#64748b"))
    nodes.append(node("text", parentId=btn_section["id"], name="Col Loading", text="LOADING", x=660, y=20, w=120, h=16, fontSize=11, fontWeight=700, fill="#64748b"))
    nodes.append(node("text", parentId=btn_section["id"], name="Col Large", text="LARGE (LG)", x=820, y=20, w=120, h=16, fontSize=11, fontWeight=700, fill="#64748b"))
    nodes.append(node("text", parentId=btn_section["id"], name="Col Small", text="SMALL (SM)", x=980, y=20, w=120, h=16, fontSize=11, fontWeight=700, fill="#64748b"))

    # Rows for button types
    btypes = [("Primary", 0), ("Secondary", 1), ("Tertiary", 2), ("Icon-only", 3)]
    states = [("Default", 180), ("Hover", 340), ("Disabled", 500), ("Loading", 660)]

    for btype, row_idx in btypes:
        row_y = 52 + row_idx * 110
        # Row label
        nodes.append(node("text",
            parentId=btn_section["id"],
            name=f"Label {btype}",
            text=f"{btype}",
            x=24, y=row_y + 12, w=140, h=20,
            fontSize=14,
            fontWeight=700,
            fill="#0f172a"
        ))

        # Standard md buttons for each state
        for state_name, col_x in states:
            if btype == "Primary":
                bg = "#2563eb" if state_name == "Default" else ("#1d4ed8" if state_name == "Hover" else ("#94a3b8" if state_name == "Disabled" else "#3b82f6"))
                fg = "#ffffff"
                st = "none"
                sw = 0
            elif btype == "Secondary":
                bg = "#ffffff" if state_name == "Default" else ("#f1f5f9" if state_name == "Hover" else ("#f8fafc" if state_name == "Disabled" else "#ffffff"))
                fg = "#0f172a" if state_name != "Disabled" else "#94a3b8"
                st = "#cbd5e1"
                sw = 1
            elif btype == "Tertiary":
                bg = "none" if state_name == "Default" else ("#f1f5f9" if state_name == "Hover" else "none")
                fg = "#2563eb" if state_name != "Disabled" else "#94a3b8"
                st = "none"
                sw = 0
            else: # Icon-only
                bg = "#2563eb" if state_name == "Default" else ("#1d4ed8" if state_name == "Hover" else ("#94a3b8" if state_name == "Disabled" else "#3b82f6"))
                fg = "#ffffff"
                st = "none"
                sw = 0

            bw = 40 if btype == "Icon-only" else 130
            btn = node("frame",
                parentId=btn_section["id"],
                name=f"type={btype}, state={state_name}, size=md",
                component=True,
                isInstance=False,
                variant={"type": btype, "state": state_name, "size": "md"},
                x=col_x, y=row_y, w=bw, h=40,
                fill=bg,
                radius=8,
                stroke=st,
                strokeWidth=sw,
                layout="horizontal",
                primaryAlign="center",
                counterAlign="center",
                padding=8,
                gap=8
            )
            nodes.append(btn)

            if state_name == "Loading":
                nodes.append(node("ellipse",
                    parentId=btn["id"],
                    name="Spinner",
                    x=14, y=12, w=16, h=16,
                    fill="none",
                    stroke=fg,
                    strokeWidth=2,
                    strokeStyle="dash",
                    strokeDash=8,
                    strokeGap=4
                ))
                nodes.append(node("text",
                    parentId=btn["id"],
                    name="Label",
                    text="Loading",
                    x=38, y=11, w=60, h=18,
                    fontSize=13,
                    fontWeight=600,
                    fill=fg
                ))
            elif btype == "Icon-only":
                nodes.append(node("text",
                    parentId=btn["id"],
                    name="Icon",
                    text="★",
                    x=12, y=10, w=16, h=18,
                    fontSize=15,
                    fontWeight=700,
                    fill=fg,
                    textAlign="center"
                ))
            else:
                nodes.append(node("text",
                    parentId=btn["id"],
                    name="Label",
                    text="Button",
                    x=12, y=11, w=106, h=18,
                    fontSize=13,
                    fontWeight=600,
                    fill=fg,
                    textAlign="center"
                ))

        # Size variants: LG and SM
        # LG at col 820
        btn_lg = node("frame",
            parentId=btn_section["id"],
            name=f"type={btype}, state=Default, size=lg",
            component=True,
            isInstance=False,
            variant={"type": btype, "state": "Default", "size": "lg"},
            x=820, y=row_y - 4, w=48 if btype == "Icon-only" else 140, h=48,
            fill="#2563eb" if btype in ("Primary", "Icon-only") else ("#ffffff" if btype == "Secondary" else "none"),
            radius=10,
            stroke="#cbd5e1" if btype == "Secondary" else "none",
            strokeWidth=1 if btype == "Secondary" else 0,
            layout="horizontal",
            primaryAlign="center",
            counterAlign="center"
        )
        nodes.append(btn_lg)
        nodes.append(node("text",
            parentId=btn_lg["id"],
            name="Label",
            text="★" if btype == "Icon-only" else "Button (LG)",
            x=12, y=14, w=24 if btype == "Icon-only" else 116, h=20,
            fontSize=15,
            fontWeight=600,
            fill="#ffffff" if btype in ("Primary", "Icon-only") else ("#0f172a" if btype == "Secondary" else "#2563eb"),
            textAlign="center"
        ))

        # SM at col 980
        btn_sm = node("frame",
            parentId=btn_section["id"],
            name=f"type={btype}, state=Default, size=sm",
            component=True,
            isInstance=False,
            variant={"type": btype, "state": "Default", "size": "sm"},
            x=980, y=row_y + 4, w=32 if btype == "Icon-only" else 110, h=32,
            fill="#2563eb" if btype in ("Primary", "Icon-only") else ("#ffffff" if btype == "Secondary" else "none"),
            radius=6,
            stroke="#cbd5e1" if btype == "Secondary" else "none",
            strokeWidth=1 if btype == "Secondary" else 0,
            layout="horizontal",
            primaryAlign="center",
            counterAlign="center"
        )
        nodes.append(btn_sm)
        nodes.append(node("text",
            parentId=btn_sm["id"],
            name="Label",
            text="★" if btype == "Icon-only" else "Button (SM)",
            x=8, y=7, w=16 if btype == "Icon-only" else 94, h=16,
            fontSize=12,
            fontWeight=600,
            fill="#ffffff" if btype in ("Primary", "Icon-only") else ("#0f172a" if btype == "Secondary" else "#2563eb"),
            textAlign="center"
        ))

    # 1.2 Links & Badges Section
    mid_section = node("frame",
        parentId=artboard["id"],
        name="Links & Badges",
        x=40, y=676, w=1120, h=220,
        fill="#ffffff",
        radius=12,
        stroke="#e2e8f0",
        strokeWidth=1,
        shadow=True,
        shadowBlur=12,
        shadowOpacity=0.04
    )
    nodes.append(mid_section)

    # Links on the left
    nodes.append(node("text", parentId=mid_section["id"], name="Links Title", text="Interactive Links", x=24, y=20, w=200, h=20, fontSize=14, fontWeight=700, fill="#0f172a"))
    link_set = node("frame", parentId=mid_section["id"], name="Link", x=24, y=52, w=500, h=140, fill="#f8fafc", radius=8, stroke="#9747ff", strokeWidth=1, strokeStyle="dash", componentSet=True, clip=False)
    nodes.append(link_set)

    link_data = [
        ("inline", "default", 16, 16, "#2563eb", "none", "Inline link (Default)"),
        ("inline", "hover", 16, 56, "#1d4ed8", "underline", "Inline link (Hover)"),
        ("inline", "visited", 16, 96, "#7c3aed", "none", "Inline link (Visited)"),
        ("standalone", "default", 260, 16, "#2563eb", "none", "Explore features →"),
        ("standalone", "hover", 260, 56, "#1d4ed8", "none", "Explore features →"),
        ("standalone", "visited", 260, 96, "#7c3aed", "none", "Explore features →")
    ]
    for lvar, lstate, lx, ly, lcol, ldec, ltxt in link_data:
        lnk = node("frame",
            parentId=link_set["id"],
            name=f"variant={lvar}, state={lstate}",
            component=True,
            isInstance=False,
            variant={"variant": lvar, "state": lstate},
            x=lx, y=ly, w=200, h=28,
            fill="none"
        )
        nodes.append(lnk)
        nodes.append(node("text", parentId=lnk["id"], name="Text", text=ltxt, x=0, y=4, w=190, h=20, fontSize=14, fontWeight=500, fill=lcol, textDecoration=ldec))

    # Badges on the right
    nodes.append(node("text", parentId=mid_section["id"], name="Badges Title", text="Badges & Status Tags", x=580, y=20, w=200, h=20, fontSize=14, fontWeight=700, fill="#0f172a"))
    badge_set = node("frame", parentId=mid_section["id"], name="Badge", x=580, y=52, w=516, h=140, fill="#f8fafc", radius=8, stroke="#9747ff", strokeWidth=1, strokeStyle="dash", componentSet=True, clip=False)
    nodes.append(badge_set)

    bcolors = {
        "neutral": ("#f1f5f9", "#475569", "#64748b"),
        "success": ("#dcfce7", "#15803d", "#22c55e"),
        "warning": ("#fef3c7", "#b45309", "#f59e0b"),
        "error": ("#fee2e2", "#b91c1c", "#ef4444")
    }
    bidx = 0
    for bstatus in ["neutral", "success", "warning", "error"]:
        bg, fg, dot_col = bcolors[bstatus]
        bx = 20 + (bidx % 2) * 240
        by = 16 + (bidx // 2) * 56
        bidx += 1

        # Medium Badge
        bg_md = node("frame",
            parentId=badge_set["id"],
            name=f"status={bstatus}, size=md",
            component=True,
            isInstance=False,
            variant={"status": bstatus, "size": "md"},
            x=bx, y=by, w=110, h=28,
            fill=bg,
            radius=9999,
            layout="horizontal",
            primaryAlign="center",
            counterAlign="center"
        )
        nodes.append(bg_md)
        nodes.append(node("ellipse", parentId=bg_md["id"], name="Dot", x=10, y=11, w=6, h=6, fill=dot_col))
        nodes.append(node("text", parentId=bg_md["id"], name="Text", text=bstatus.capitalize(), x=22, y=6, w=70, h=16, fontSize=12, fontWeight=600, fill=fg))

        # Small Badge
        bg_sm = node("frame",
            parentId=badge_set["id"],
            name=f"status={bstatus}, size=sm",
            component=True,
            isInstance=False,
            variant={"status": bstatus, "size": "sm"},
            x=bx + 120, y=by + 2, w=90, h=24,
            fill=bg,
            radius=9999,
            layout="horizontal",
            primaryAlign="center",
            counterAlign="center"
        )
        nodes.append(bg_sm)
        nodes.append(node("ellipse", parentId=bg_sm["id"], name="Dot", x=8, y=9, w=6, h=6, fill=dot_col))
        nodes.append(node("text", parentId=bg_sm["id"], name="Text", text=bstatus.capitalize(), x=18, y=4, w=60, h=14, fontSize=11, fontWeight=600, fill=fg))

    # 1.3 System Icons (24 Components)
    icon_section = node("frame",
        parentId=artboard["id"],
        name="System Icons (24 Components)",
        x=40, y=916, w=1120, h=460,
        fill="#ffffff",
        radius=12,
        stroke="#e2e8f0",
        strokeWidth=1,
        shadow=True,
        shadowBlur=12,
        shadowOpacity=0.04
    )
    nodes.append(icon_section)
    nodes.append(node("text", parentId=icon_section["id"], name="Icons Title", text="System Vector Icons", x=24, y=20, w=300, h=20, fontSize=14, fontWeight=700, fill="#0f172a"))

    icons_24 = [
        ("Icon/home", "⌂", "Home"), ("Icon/search", "⚲", "Search"), ("Icon/menu", "≡", "Menu"),
        ("Icon/chevron-left", "‹", "Back"), ("Icon/chevron-right", "›", "Next"), ("Icon/chevron-down", "⌄", "Dropdown"),
        ("Icon/plus", "+", "Add"), ("Icon/edit", "✎", "Edit"), ("Icon/trash", "🗑", "Delete"),
        ("Icon/share", "↗", "Share"), ("Icon/copy", "⧉", "Copy"), ("Icon/download", "⤓", "Download"),
        ("Icon/check", "✓", "Confirm"), ("Icon/close", "✕", "Close"), ("Icon/info", "ℹ", "Info"),
        ("Icon/success", "✔", "Success"), ("Icon/warning", "⚠", "Warning"), ("Icon/error", "✖", "Error"),
        ("Icon/alert", "!", "Alert"), ("Icon/settings", "⚙", "Settings"), ("Icon/user", "👤", "User"),
        ("Icon/mail", "✉", "Mail"), ("Icon/bell", "🔔", "Notice"), ("Icon/calendar", "📅", "Calendar")
    ]

    for idx, (ic_name, glyph, label) in enumerate(icons_24):
        col = idx % 6
        row = idx // 6
        ic_x = 24 + col * 182
        ic_y = 56 + row * 94

        ic_card = node("frame",
            parentId=icon_section["id"],
            name=ic_name,
            component=True,
            isInstance=False,
            x=ic_x, y=ic_y, w=166, h=80,
            fill="#f8fafc",
            radius=8,
            stroke="#e2e8f0",
            strokeWidth=1
        )
        nodes.append(ic_card)
        nodes.append(node("text",
            parentId=ic_card["id"],
            name="Glyph",
            text=glyph,
            x=16, y=22, w=36, h=36,
            fontSize=24,
            fontWeight=700,
            fill="#1e293b",
            textAlign="center"
        ))
        nodes.append(node("text",
            parentId=ic_card["id"],
            name="Name",
            text=ic_name.split("/")[1],
            x=60, y=24, w=96, h=16,
            fontSize=12,
            fontWeight=600,
            fill="#0f172a"
        ))
        nodes.append(node("text",
            parentId=ic_card["id"],
            name="Tag",
            text="Component",
            x=60, y=42, w=96, h=14,
            fontSize=10,
            fontWeight=500,
            fill="#94a3b8"
        ))

    return nodes

# =============================================================================
# PAGE 2: 02 · Forms
# =============================================================================
def build_page_forms():
    nodes = []
    artboard = node("frame",
        name="02 · Forms",
        x=0, y=0, w=1200, h=1460,
        fill="#f8fafc",
        clip=False
    )
    nodes.append(artboard)
    add_page_header(nodes, artboard["id"], "02 · Forms & Input Fields", "Text Inputs, Selection Controls, Dropdown Menus, and Pickers")

    # 2.1 Text Inputs ComponentSet
    in_section = node("frame",
        parentId=artboard["id"],
        name="Input Variants",
        x=40, y=136, w=1120, h=480,
        fill="#ffffff",
        radius=12,
        stroke="#9747ff",
        strokeWidth=1,
        strokeStyle="dash",
        strokeDash=6,
        strokeGap=4,
        componentSet=True,
        clip=False
    )
    nodes.append(in_section)

    nodes.append(node("text", parentId=in_section["id"], name="Col 1", text="DEFAULT STATE", x=24, y=20, w=240, h=16, fontSize=11, fontWeight=700, fill="#64748b"))
    nodes.append(node("text", parentId=in_section["id"], name="Col 2", text="FOCUSED STATE", x=300, y=20, w=240, h=16, fontSize=11, fontWeight=700, fill="#64748b"))
    nodes.append(node("text", parentId=in_section["id"], name="Col 3", text="ERROR STATE", x=580, y=20, w=240, h=16, fontSize=11, fontWeight=700, fill="#64748b"))
    nodes.append(node("text", parentId=in_section["id"], name="Col 4", text="DISABLED STATE", x=850, y=20, w=240, h=16, fontSize=11, fontWeight=700, fill="#64748b"))

    input_grid = [
        ("text", "Text Input", "jane.doe@example.com"),
        ("password", "Password Field", "••••••••••••"),
        ("search", "Search Field", "Search components…"),
        ("textarea", "Textarea Area", "Enter your feedback description here…")
    ]

    for row_idx, (itype, ilabel, ival) in enumerate(input_grid):
        row_y = 50 + row_idx * 102
        ih = 72 if itype == "textarea" else 40

        for col_idx, istate in enumerate(["default", "focus", "error", "disabled"]):
            col_x = 24 + col_idx * 276
            st_color = "#3b82f6" if istate == "focus" else ("#ef4444" if istate == "error" else "#cbd5e1")
            st_width = 2 if istate in ("focus", "error") else 1
            bg_color = "#f8fafc" if istate == "disabled" else "#ffffff"

            in_comp = node("frame",
                parentId=in_section["id"],
                name=f"type={itype}, state={istate}",
                component=True,
                isInstance=False,
                variant={"type": itype, "state": istate},
                x=col_x, y=row_y, w=256, h=ih + 40,
                fill="none"
            )
            nodes.append(in_comp)

            # Label
            nodes.append(node("text",
                parentId=in_comp["id"],
                name="Label",
                text=ilabel,
                x=0, y=0, w=250, h=16,
                fontSize=12,
                fontWeight=600,
                fill="#b91c1c" if istate == "error" else "#334155"
            ))

            # Input Box
            ibox = node("frame",
                parentId=in_comp["id"],
                name="Box",
                x=0, y=20, w=256, h=ih,
                fill=bg_color,
                radius=8,
                stroke=st_color,
                strokeWidth=st_width
            )
            nodes.append(ibox)

            # Icon or text inside box
            tx = 12
            if itype == "search":
                nodes.append(node("text", parentId=ibox["id"], name="Icon", text="⚲", x=10, y=10, w=16, h=16, fontSize=14, fill="#94a3b8"))
                tx = 30

            nodes.append(node("text",
                parentId=ibox["id"],
                name="Value",
                text=ival,
                x=tx, y=10, w=210, h=18,
                fontSize=13,
                fontWeight=400,
                fill="#94a3b8" if istate == "disabled" else "#0f172a"
            ))

            # Helper/error below
            msg = "This field has an error." if istate == "error" else ("Helper text" if istate == "default" else "")
            if msg:
                nodes.append(node("text",
                    parentId=in_comp["id"],
                    name="Hint",
                    text=msg,
                    x=0, y=24 + ih, w=250, h=14,
                    fontSize=11,
                    fill="#ef4444" if istate == "error" else "#64748b"
                ))

    # 2.2 Selection Controls
    sel_section = node("frame",
        parentId=artboard["id"],
        name="Selection Controls",
        x=40, y=636, w=1120, h=300,
        fill="#ffffff",
        radius=12,
        stroke="#e2e8f0",
        strokeWidth=1,
        shadow=True,
        shadowBlur=12,
        shadowOpacity=0.04
    )
    nodes.append(sel_section)

    # Checkboxes Card
    nodes.append(node("text", parentId=sel_section["id"], name="T1", text="Checkboxes", x=24, y=20, w=200, h=20, fontSize=14, fontWeight=700, fill="#0f172a"))
    cb_set = node("frame", parentId=sel_section["id"], name="Checkbox", x=24, y=50, w=330, h=220, fill="#f8fafc", radius=8, stroke="#9747ff", strokeWidth=1, strokeStyle="dash", componentSet=True, clip=False)
    nodes.append(cb_set)

    cb_list = [(True, False, 16, "Checked (Active)"), (False, False, 60, "Unchecked (Default)"), (True, True, 104, "Checked (Disabled)"), (False, True, 148, "Unchecked (Disabled)")]
    for chk, dis, cy, clbl in cb_list:
        bg = ("#2563eb" if chk else "#ffffff") if not dis else ("#94a3b8" if chk else "#f1f5f9")
        st = ("#2563eb" if chk else "#cbd5e1") if not dis else "#cbd5e1"
        cbi = node("frame", parentId=cb_set["id"], name=f"checked={str(chk).lower()}, disabled={str(dis).lower()}", component=True, isInstance=False, variant={"checked": str(chk).lower(), "disabled": str(dis).lower()}, x=16, y=cy, w=290, h=32, fill="none")
        nodes.append(cbi)
        bx = node("frame", parentId=cbi["id"], name="Box", x=0, y=6, w=20, h=20, fill=bg, radius=4, stroke=st, strokeWidth=1)
        nodes.append(bx)
        if chk:
            nodes.append(node("text", parentId=bx["id"], name="Check", text="✓", x=3, y=1, w=14, h=14, fontSize=12, fontWeight=700, fill="#ffffff", textAlign="center"))
        nodes.append(node("text", parentId=cbi["id"], name="Label", text=clbl, x=30, y=7, w=240, h=18, fontSize=13, fill="#0f172a" if not dis else "#94a3b8"))

    # Radios Card
    nodes.append(node("text", parentId=sel_section["id"], name="T2", text="Radio Buttons", x=390, y=20, w=200, h=20, fontSize=14, fontWeight=700, fill="#0f172a"))
    rd_set = node("frame", parentId=sel_section["id"], name="Radio", x=390, y=50, w=330, h=220, fill="#f8fafc", radius=8, stroke="#9747ff", strokeWidth=1, strokeStyle="dash", componentSet=True, clip=False)
    nodes.append(rd_set)

    rd_list = [(True, False, 16, "Selected Option"), (False, False, 60, "Unselected Option"), (True, True, 104, "Selected (Disabled)"), (False, True, 148, "Unselected (Disabled)")]
    for chk, dis, ry, rlbl in rd_list:
        st = ("#2563eb" if chk else "#cbd5e1") if not dis else "#cbd5e1"
        rdi = node("frame", parentId=rd_set["id"], name=f"checked={str(chk).lower()}, disabled={str(dis).lower()}", component=True, isInstance=False, variant={"checked": str(chk).lower(), "disabled": str(dis).lower()}, x=16, y=ry, w=290, h=32, fill="none")
        nodes.append(rdi)
        cir = node("ellipse", parentId=rdi["id"], name="Circle", x=0, y=6, w=20, h=20, fill="#ffffff" if not dis else "#f1f5f9", stroke=st, strokeWidth=2)
        nodes.append(cir)
        if chk:
            nodes.append(node("ellipse", parentId=rdi["id"], name="Dot", x=5, y=11, w=10, h=10, fill="#2563eb" if not dis else "#94a3b8"))
        nodes.append(node("text", parentId=rdi["id"], name="Label", text=rlbl, x=30, y=7, w=240, h=18, fontSize=13, fill="#0f172a" if not dis else "#94a3b8"))

    # Switches Card
    nodes.append(node("text", parentId=sel_section["id"], name="T3", text="Toggle Switches", x=760, y=20, w=200, h=20, fontSize=14, fontWeight=700, fill="#0f172a"))
    sw_set = node("frame", parentId=sel_section["id"], name="Switch", x=760, y=50, w=330, h=220, fill="#f8fafc", radius=8, stroke="#9747ff", strokeWidth=1, strokeStyle="dash", componentSet=True, clip=False)
    nodes.append(sw_set)

    sw_list = [(True, False, 16, "Active Switch (ON)"), (False, False, 60, "Inactive Switch (OFF)"), (True, True, 104, "Active (Disabled)"), (False, True, 148, "Inactive (Disabled)")]
    for chk, dis, sy, slbl in sw_list:
        track_col = ("#2563eb" if chk else "#cbd5e1") if not dis else ("#93c5fd" if chk else "#e2e8f0")
        swi = node("frame", parentId=sw_set["id"], name=f"checked={str(chk).lower()}, disabled={str(dis).lower()}", component=True, isInstance=False, variant={"checked": str(chk).lower(), "disabled": str(dis).lower()}, x=16, y=sy, w=290, h=32, fill="none")
        nodes.append(swi)
        tr = node("frame", parentId=swi["id"], name="Track", x=0, y=4, w=44, h=24, fill=track_col, radius=9999)
        nodes.append(tr)
        thumb_x = 22 if chk else 2
        nodes.append(node("ellipse", parentId=tr["id"], name="Thumb", x=thumb_x, y=2, w=20, h=20, fill="#ffffff", shadow=True, shadowBlur=4, shadowOpacity=0.15))
        nodes.append(node("text", parentId=swi["id"], name="Label", text=slbl, x=54, y=7, w=220, h=18, fontSize=13, fill="#0f172a" if not dis else "#94a3b8"))

    # 2.3 Select, Slider, DatePicker
    bot_section = node("frame",
        parentId=artboard["id"],
        name="Select & Pickers",
        x=40, y=956, w=1120, h=460,
        fill="#ffffff",
        radius=12,
        stroke="#e2e8f0",
        strokeWidth=1,
        shadow=True,
        shadowBlur=12,
        shadowOpacity=0.04
    )
    nodes.append(bot_section)

    # Select Dropdown ComponentSet
    nodes.append(node("text", parentId=bot_section["id"], name="T_Sel", text="Select Dropdown Menu", x=24, y=20, w=260, h=20, fontSize=14, fontWeight=700, fill="#0f172a"))
    sel_set = node("frame", parentId=bot_section["id"], name="Select", x=24, y=52, w=340, h=380, fill="#f8fafc", radius=8, stroke="#9747ff", strokeWidth=1, strokeStyle="dash", componentSet=True, clip=False)
    nodes.append(sel_set)

    # Closed Variant
    s_closed = node("frame", parentId=sel_set["id"], name="mode=single, state=closed", component=True, isInstance=False, variant={"mode": "single", "state": "closed"}, x=16, y=16, w=300, h=68, fill="none")
    nodes.append(s_closed)
    nodes.append(node("text", parentId=s_closed["id"], name="Label", text="Category (Single · Closed)", x=0, y=0, w=200, h=16, fontSize=12, fontWeight=600, fill="#334155"))
    c_box = node("frame", parentId=s_closed["id"], name="Box", x=0, y=22, w=300, h=42, fill="#ffffff", radius=8, stroke="#cbd5e1", strokeWidth=1)
    nodes.append(c_box)
    nodes.append(node("text", parentId=c_box["id"], name="Val", text="Design Systems", x=12, y=11, w=220, h=18, fontSize=13, fill="#0f172a"))
    nodes.append(node("text", parentId=c_box["id"], name="Arr", text="▾", x=272, y=10, w=16, h=16, fontSize=14, fill="#64748b"))

    # Open Variant
    s_open = node("frame", parentId=sel_set["id"], name="mode=single, state=open", component=True, isInstance=False, variant={"mode": "single", "state": "open"}, x=16, y=100, w=300, h=250, fill="none")
    nodes.append(s_open)
    nodes.append(node("text", parentId=s_open["id"], name="Label", text="Category (Single · Open)", x=0, y=0, w=200, h=16, fontSize=12, fontWeight=600, fill="#334155"))
    o_box = node("frame", parentId=s_open["id"], name="Box", x=0, y=22, w=300, h=42, fill="#ffffff", radius=8, stroke="#3b82f6", strokeWidth=1.5)
    nodes.append(o_box)
    nodes.append(node("text", parentId=o_box["id"], name="Val", text="Design Systems", x=12, y=11, w=220, h=18, fontSize=13, fill="#0f172a"))
    nodes.append(node("text", parentId=o_box["id"], name="Arr", text="▴", x=272, y=10, w=16, h=16, fontSize=14, fill="#3b82f6"))

    menu = node("frame", parentId=s_open["id"], name="Menu", x=0, y=68, w=300, h=160, fill="#ffffff", radius=8, stroke="#e2e8f0", strokeWidth=1, shadow=True, shadowBlur=16, shadowOpacity=0.1)
    nodes.append(menu)
    for mi, (mtitle, mact) in enumerate([("Design Systems", True), ("UI Foundations", False), ("Component Tokens", False), ("Page Templates", False)]):
        m_item = node("frame", parentId=menu["id"], name=f"Option {mi+1}", x=6, y=6 + mi * 38, w=288, h=34, fill="#eff6ff" if mact else "#ffffff", radius=6)
        nodes.append(m_item)
        nodes.append(node("text", parentId=m_item["id"], name="Text", text=mtitle, x=10, y=8, w=220, h=18, fontSize=13, fontWeight=600 if mact else 400, fill="#1d4ed8" if mact else "#334155"))
        if mact:
            nodes.append(node("text", parentId=m_item["id"], name="Check", text="✓", x=260, y=8, w=16, h=16, fontSize=13, fill="#1d4ed8"))

    # Slider Component
    nodes.append(node("text", parentId=bot_section["id"], name="T_Sld", text="Interactive Slider", x=400, y=20, w=200, h=20, fontSize=14, fontWeight=700, fill="#0f172a"))
    slider_card = node("frame", parentId=bot_section["id"], name="Component/Slider", component=True, isInstance=False, x=400, y=52, w=320, h=140, fill="#f8fafc", radius=8, stroke="#e2e8f0", strokeWidth=1)
    nodes.append(slider_card)
    nodes.append(node("text", parentId=slider_card["id"], name="Title", text="Volume Level · 65%", x=20, y=24, w=200, h=18, fontSize=13, fontWeight=600, fill="#0f172a"))
    # Track
    track = node("frame", parentId=slider_card["id"], name="Track", x=20, y=64, w=280, h=8, fill="#e2e8f0", radius=9999)
    nodes.append(track)
    nodes.append(node("frame", parentId=track["id"], name="Filled", x=0, y=0, w=182, h=8, fill="#2563eb", radius=9999))
    nodes.append(node("ellipse", parentId=slider_card["id"], name="Thumb", x=192, y=58, w=20, h=20, fill="#ffffff", stroke="#2563eb", strokeWidth=3, shadow=True, shadowBlur=6, shadowOpacity=0.15))
    nodes.append(node("text", parentId=slider_card["id"], name="Min", text="0%", x=20, y=86, w=40, h=14, fontSize=11, fill="#94a3b8"))
    nodes.append(node("text", parentId=slider_card["id"], name="Max", text="100%", x=260, y=86, w=40, h=14, fontSize=11, fill="#94a3b8", textAlign="right"))

    # DatePicker Component
    nodes.append(node("text", parentId=bot_section["id"], name="T_DP", text="DatePicker Calendar", x=760, y=20, w=200, h=20, fontSize=14, fontWeight=700, fill="#0f172a"))
    dp_comp = node("frame", parentId=bot_section["id"], name="Component/DatePicker", component=True, isInstance=False, x=760, y=52, w=330, h=360, fill="#ffffff", radius=10, stroke="#e2e8f0", strokeWidth=1, shadow=True, shadowBlur=16, shadowOpacity=0.06)
    nodes.append(dp_comp)

    # Month Header
    nodes.append(node("text", parentId=dp_comp["id"], name="Month", text="October 2026", x=20, y=20, w=160, h=20, fontSize=14, fontWeight=700, fill="#0f172a"))
    nodes.append(node("text", parentId=dp_comp["id"], name="Nav", text="‹   ›", x=270, y=18, w=40, h=20, fontSize=16, fontWeight=700, fill="#64748b"))

    # Weekdays
    wkd = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
    for wi, wday in enumerate(wkd):
        nodes.append(node("text", parentId=dp_comp["id"], name=f"Wk_{wday}", text=wday, x=20 + wi * 42, y=56, w=30, h=16, fontSize=12, fontWeight=600, fill="#94a3b8", textAlign="center"))

    # Days grid
    days = [
        [28, 29, 30, 1, 2, 3, 4],
        [5, 6, 7, 8, 9, 10, 11],
        [12, 13, 14, 15, 16, 17, 18],
        [19, 20, 21, 22, 23, 24, 25],
        [26, 27, 28, 29, 30, 31, 1]
    ]
    for row_i, row in enumerate(days):
        for col_i, dnum in enumerate(row):
            is_active = (row_i == 2 and col_i == 3) # 15th
            is_muted = (row_i == 0 and dnum > 20) or (row_i == 4 and dnum == 1)
            dx = 16 + col_i * 42
            dy = 86 + row_i * 42

            if is_active:
                nodes.append(node("ellipse", parentId=dp_comp["id"], name="Active BG", x=dx+2, y=dy, w=30, h=30, fill="#2563eb"))
                nodes.append(node("text", parentId=dp_comp["id"], name=f"D_{dnum}", text=str(dnum), x=dx+2, y=dy+6, w=30, h=16, fontSize=12, fontWeight=700, fill="#ffffff", textAlign="center"))
            else:
                nodes.append(node("text", parentId=dp_comp["id"], name=f"D_{dnum}", text=str(dnum), x=dx+2, y=dy+6, w=30, h=16, fontSize=12, fontWeight=500, fill="#cbd5e1" if is_muted else "#334155", textAlign="center"))

    return nodes

# =============================================================================
# PAGE 3: 03 · Navigation
# =============================================================================
def build_page_navigation():
    nodes = []
    artboard = node("frame",
        name="03 · Navigation",
        x=0, y=0, w=1280, h=1440,
        fill="#f8fafc",
        clip=False
    )
    nodes.append(artboard)
    add_page_header(nodes, artboard["id"], "03 · Navigation & Menus", "Navbar, Sidebars (Expanded & Collapsed), Breadcrumbs, Tabs, and Footer")

    # 3.1 Header / Navbar Component
    nav_box = node("frame",
        parentId=artboard["id"],
        name="Component/Navbar",
        component=True,
        isInstance=False,
        x=40, y=136, w=1200, h=72,
        fill="#ffffff",
        radius=12,
        stroke="#e2e8f0",
        strokeWidth=1,
        shadow=True,
        shadowBlur=16,
        shadowOpacity=0.06
    )
    nodes.append(nav_box)

    # Brand
    nodes.append(node("rect", parentId=nav_box["id"], name="Brand Mark", x=24, y=20, w=32, h=32, fill="#2563eb", radius=8))
    nodes.append(node("text", parentId=nav_box["id"], name="Brand Title", text="MIDAS", x=66, y=25, w=80, h=22, fontSize=16, fontWeight=800, fill="#0f172a"))

    # Nav links
    nav_items = [("Overview", True), ("Design System", False), ("Tokens", False), ("Templates", False), ("Docs", False)]
    for ni, (ntitle, nact) in enumerate(nav_items):
        nodes.append(node("text",
            parentId=nav_box["id"],
            name=f"Nav {ntitle}",
            text=ntitle,
            x=200 + ni * 110, y=26, w=90, h=20,
            fontSize=13,
            fontWeight=700 if nact else 500,
            fill="#2563eb" if nact else "#475569"
        ))

    # Right side
    s_box = node("frame", parentId=nav_box["id"], name="Search", x=780, y=18, w=180, h=36, fill="#f1f5f9", radius=8)
    nodes.append(s_box)
    nodes.append(node("text", parentId=s_box["id"], name="S_Icon", text="⚲", x=10, y=8, w=16, h=16, fontSize=13, fill="#94a3b8"))
    nodes.append(node("text", parentId=s_box["id"], name="S_Txt", text="Search…", x=30, y=9, w=120, h=16, fontSize=12, fill="#94a3b8"))

    cta = node("frame", parentId=nav_box["id"], name="CTA", x=980, y=18, w=110, h=36, fill="#2563eb", radius=8)
    nodes.append(cta)
    nodes.append(node("text", parentId=cta["id"], name="CTA_Txt", text="Upgrade Pro", x=0, y=9, w=110, h=18, fontSize=12, fontWeight=600, fill="#ffffff", textAlign="center"))

    nodes.append(node("ellipse", parentId=nav_box["id"], name="Avatar", x=1110, y=18, w=36, h=36, fill="#cbd5e1"))

    # 3.2 Sidebars & Widgets Section
    mid_wrap = node("frame",
        parentId=artboard["id"],
        name="Sidebars & Navigation Widgets",
        x=40, y=232, w=1200, h=660,
        fill="none"
    )
    nodes.append(mid_wrap)

    # Sidebar ComponentSet
    sb_set = node("frame",
        parentId=mid_wrap["id"],
        name="Sidebar",
        x=0, y=0, w=440, h=660,
        fill="#ffffff",
        radius=12,
        stroke="#9747ff",
        strokeWidth=1,
        strokeStyle="dash",
        componentSet=True,
        clip=False
    )
    nodes.append(sb_set)

    # Expanded Sidebar Variant
    sb_exp = node("frame",
        parentId=sb_set["id"],
        name="state=expanded",
        component=True,
        isInstance=False,
        variant={"state": "expanded"},
        x=20, y=20, w=260, h=620,
        fill="#0f172a",
        radius=10
    )
    nodes.append(sb_exp)

    # Logo
    nodes.append(node("rect", parentId=sb_exp["id"], name="Logo", x=20, y=24, w=28, h=28, fill="#3b82f6", radius=6))
    nodes.append(node("text", parentId=sb_exp["id"], name="Title", text="Midas Studio", x=58, y=28, w=160, h=20, fontSize=15, fontWeight=700, fill="#ffffff"))

    # Links
    sb_links = [("▦", "Dashboard", True), ("⌂", "All Projects", False), ("⧉", "Design System", False), ("⚙", "Settings", False), ("?", "Help Center", False)]
    for sbi, (sico, slbl, sact) in enumerate(sb_links):
        row_bg = "#1e293b" if sact else "none"
        srow = node("frame", parentId=sb_exp["id"], name=f"Row_{slbl}", x=14, y=80 + sbi * 46, w=232, h=38, fill=row_bg, radius=6)
        nodes.append(srow)
        nodes.append(node("text", parentId=srow["id"], name="Icon", text=sico, x=12, y=9, w=20, h=20, fontSize=15, fill="#3b82f6" if sact else "#94a3b8"))
        nodes.append(node("text", parentId=srow["id"], name="Label", text=slbl, x=40, y=10, w=160, h=18, fontSize=13, fontWeight=600 if sact else 400, fill="#ffffff" if sact else "#cbd5e1"))

    # Bottom user card
    user_c = node("frame", parentId=sb_exp["id"], name="User", x=14, y=550, w=232, h=52, fill="#1e293b", radius=8)
    nodes.append(user_c)
    nodes.append(node("ellipse", parentId=user_c["id"], name="Av", x=12, y=10, w=32, h=32, fill="#3b82f6"))
    nodes.append(node("text", parentId=user_c["id"], name="U_Name", text="Jamie Davis", x=54, y=10, w=140, h=16, fontSize=12, fontWeight=600, fill="#ffffff"))
    nodes.append(node("text", parentId=user_c["id"], name="U_Role", text="Pro Workspace", x=54, y=28, w=140, h=14, fontSize=10, fill="#94a3b8"))

    # Collapsed Sidebar Variant
    sb_col = node("frame",
        parentId=sb_set["id"],
        name="state=collapsed",
        component=True,
        isInstance=False,
        variant={"state": "collapsed"},
        x=300, y=20, w=68, h=620,
        fill="#0f172a",
        radius=10
    )
    nodes.append(sb_col)
    nodes.append(node("rect", parentId=sb_col["id"], name="Logo", x=20, y=24, w=28, h=28, fill="#3b82f6", radius=6))
    for sbi, (sico, _, sact) in enumerate(sb_links):
        crow = node("frame", parentId=sb_col["id"], name="Icon_Row", x=14, y=80 + sbi * 46, w=40, h=38, fill="#1e293b" if sact else "none", radius=6)
        nodes.append(crow)
        nodes.append(node("text", parentId=crow["id"], name="Icon", text=sico, x=10, y=9, w=20, h=20, fontSize=15, fill="#3b82f6" if sact else "#94a3b8", textAlign="center"))

    # Right side widgets (Breadcrumbs, Tabs, Pagination)
    w_card = node("frame",
        parentId=mid_wrap["id"],
        name="Breadcrumbs, Tabs & Pagination",
        x=460, y=0, w=740, h=660,
        fill="#ffffff",
        radius=12,
        stroke="#e2e8f0",
        strokeWidth=1,
        shadow=True,
        shadowBlur=12,
        shadowOpacity=0.04
    )
    nodes.append(w_card)

    # Breadcrumbs
    nodes.append(node("text", parentId=w_card["id"], name="T_BC", text="Breadcrumbs Hierarchy", x=24, y=24, w=300, h=20, fontSize=14, fontWeight=700, fill="#0f172a"))
    bc_comp = node("frame", parentId=w_card["id"], name="Component/Breadcrumbs", component=True, isInstance=False, x=24, y=56, w=680, h=44, fill="#f8fafc", radius=8)
    nodes.append(bc_comp)
    crumbs = ["Workspace", "/", "Projects", "/", "Midas Mobile App", "/", "Canvas Editor"]
    cx = 16
    for cr in crumbs:
        is_cur = cr == "Canvas Editor"
        is_slash = cr == "/"
        cw = 14 if is_slash else (90 if is_cur else 75)
        nodes.append(node("text",
            parentId=bc_comp["id"],
            name=f"C_{cr}",
            text=cr,
            x=cx, y=13, w=cw, h=18,
            fontSize=13,
            fontWeight=700 if is_cur else 500,
            fill="#0f172a" if is_cur else ("#94a3b8" if is_slash else "#2563eb")
        ))
        cx += cw + 8

    # Tabs ComponentSet
    nodes.append(node("text", parentId=w_card["id"], name="T_Tabs", text="Navigation Tabs", x=24, y=130, w=300, h=20, fontSize=14, fontWeight=700, fill="#0f172a"))
    tabs_set = node("frame", parentId=w_card["id"], name="Tabs", x=24, y=162, w=680, h=160, fill="#f8fafc", radius=8, stroke="#9747ff", strokeWidth=1, strokeStyle="dash", componentSet=True, clip=False)
    nodes.append(tabs_set)

    for ti, act_tab in enumerate(["tab1", "tab2"]):
        t_frame = node("frame", parentId=tabs_set["id"], name=f"active={act_tab}", component=True, isInstance=False, variant={"active": act_tab}, x=16, y=16 + ti * 70, w=640, h=48, fill="none")
        nodes.append(t_frame)

        tab_items = [("tab1", "Design Canvas"), ("tab2", "Prototype Flow"), ("tab3", "Inspect Code")]
        for tab_id, tab_label in tab_items:
            is_active = act_tab == tab_id
            tx = 20 + tab_items.index((tab_id, tab_label)) * 140
            nodes.append(node("text",
                parentId=t_frame["id"],
                name="Txt",
                text=tab_label,
                x=tx, y=12, w=120, h=20,
                fontSize=13,
                fontWeight=700 if is_active else 500,
                fill="#2563eb" if is_active else "#64748b"
            ))
            if is_active:
                nodes.append(node("rect", parentId=t_frame["id"], name="Line", x=tx, y=38, w=110, h=3, fill="#2563eb", radius=2))

    # Pagination Component
    nodes.append(node("text", parentId=w_card["id"], name="T_Pg", text="Pagination Controls", x=24, y=350, w=300, h=20, fontSize=14, fontWeight=700, fill="#0f172a"))
    pg_comp = node("frame", parentId=w_card["id"], name="Component/Pagination", component=True, isInstance=False, x=24, y=382, w=680, h=60, fill="#f8fafc", radius=8)
    nodes.append(pg_comp)

    p_buttons = ["‹ Previous", "1", "2", "3", "…", "10", "Next ›"]
    px = 24
    for pb in p_buttons:
        is_num = pb in ("1", "2", "3", "10")
        is_act = pb == "1"
        pw = 36 if is_num or pb == "…" else 86
        p_card = node("frame", parentId=pg_comp["id"], name=f"Btn_{pb}", x=px, y=12, w=pw, h=36, fill="#2563eb" if is_act else "#ffffff", radius=6, stroke="none" if is_act else "#e2e8f0", strokeWidth=1)
        nodes.append(p_card)
        nodes.append(node("text",
            parentId=p_card["id"],
            name="Txt",
            text=pb,
            x=0, y=9, w=pw, h=18,
            fontSize=13,
            fontWeight=700 if is_act else 500,
            fill="#ffffff" if is_act else "#334155",
            textAlign="center"
        ))
        px += pw + 8

    # 3.3 Desktop Footer Component
    ft_box = node("frame",
        parentId=artboard["id"],
        name="Component/Footer",
        component=True,
        isInstance=False,
        x=40, y=920, w=1200, h=260,
        fill="#0f172a",
        radius=12
    )
    nodes.append(ft_box)

    # Brand col
    nodes.append(node("text", parentId=ft_box["id"], name="Logo", text="MIDAS DESIGN SYSTEM", x=36, y=36, w=300, h=24, fontSize=16, fontWeight=800, fill="#ffffff"))
    nodes.append(node("text", parentId=ft_box["id"], name="Desc", text="Local-first canvas design tool built for lightning fast vector workflows and design systems.", x=36, y=68, w=340, h=40, fontSize=13, fill="#94a3b8"))
    nodes.append(node("text", parentId=ft_box["id"], name="Copy", text="© 2026 Midas Inc. All rights reserved.", x=36, y=200, w=300, h=18, fontSize=12, fill="#64748b"))

    # Link columns
    fcols = [("Products", ["Design Canvas", "Prototyping", "Design Tokens", "Plugin Hub"]), ("Resources", ["Documentation", "Figma Migration", "API Reference", "Community"]), ("Company", ["About Us", "Careers", "Security", "Contact"])]
    for fci, (ftitle, flinks) in enumerate(fcols):
        fx = 480 + fci * 240
        nodes.append(node("text", parentId=ft_box["id"], name=f"TH_{ftitle}", text=ftitle, x=fx, y=36, w=180, h=20, fontSize=14, fontWeight=700, fill="#ffffff"))
        for fli, flink in enumerate(flinks):
            nodes.append(node("text", parentId=ft_box["id"], name=f"L_{flink}", text=flink, x=fx, y=70 + fli * 28, w=180, h=18, fontSize=13, fill="#94a3b8"))

    return nodes

# =============================================================================
# PAGE 4: 04 · Data Display
# =============================================================================
def build_page_data_display():
    nodes = []
    artboard = node("frame",
        name="04 · Data Display",
        x=0, y=0, w=1280, h=1520,
        fill="#f8fafc",
        clip=False
    )
    nodes.append(artboard)
    add_page_header(nodes, artboard["id"], "04 · Data Display & Containers", "Cards, Data Tables, Formatted Lists, Accordions, and Avatar System")

    # 4.1 Cards ComponentSet
    cards_section = node("frame",
        parentId=artboard["id"],
        name="Card",
        x=40, y=136, w=1200, h=480,
        fill="#ffffff",
        radius=12,
        stroke="#9747ff",
        strokeWidth=1,
        strokeStyle="dash",
        strokeDash=6,
        strokeGap=4,
        componentSet=True,
        clip=False
    )
    nodes.append(cards_section)

    # Product Card
    c_prod = node("frame", parentId=cards_section["id"], name="variant=Product", component=True, isInstance=False, variant={"variant": "Product"}, x=32, y=24, w=350, h=430, fill="#ffffff", radius=10, stroke="#e2e8f0", strokeWidth=1, shadow=True, shadowBlur=16, shadowOpacity=0.06)
    nodes.append(c_prod)
    nodes.append(node("rect", parentId=c_prod["id"], name="Image", x=16, y=16, w=318, h=180, fill="#e2e8f0", radius=8))
    nodes.append(node("text", parentId=c_prod["id"], name="Badge", text="HARDWARE · TOOL", x=16, y=210, w=160, h=14, fontSize=10, fontWeight=700, fill="#2563eb"))
    nodes.append(node("text", parentId=c_prod["id"], name="Title", text="Midas Precision Pen 2", x=16, y=230, w=318, h=22, fontSize=16, fontWeight=700, fill="#0f172a"))
    nodes.append(node("text", parentId=c_prod["id"], name="Price", text="$89.00 USD", x=16, y=260, w=140, h=20, fontSize=15, fontWeight=600, fill="#16a34a"))
    b_buy = node("frame", parentId=c_prod["id"], name="CTA", x=16, y=366, w=318, h=44, fill="#2563eb", radius=8)
    nodes.append(b_buy)
    nodes.append(node("text", parentId=b_buy["id"], name="Txt", text="Add to Cart", x=0, y=13, w=318, h=18, fontSize=13, fontWeight=600, fill="#ffffff", textAlign="center"))

    # Article Card
    c_art = node("frame", parentId=cards_section["id"], name="variant=Article", component=True, isInstance=False, variant={"variant": "Article"}, x=424, y=24, w=350, h=430, fill="#ffffff", radius=10, stroke="#e2e8f0", strokeWidth=1, shadow=True, shadowBlur=16, shadowOpacity=0.06)
    nodes.append(c_art)
    nodes.append(node("rect", parentId=c_art["id"], name="Image", x=16, y=16, w=318, h=180, fill="#cbd5e1", radius=8))
    nodes.append(node("text", parentId=c_art["id"], name="Meta", text="5 min read · Oct 15, 2026", x=16, y=210, w=200, h=14, fontSize=11, fontWeight=500, fill="#64748b"))
    nodes.append(node("text", parentId=c_art["id"], name="Title", text="Building Next-Gen Vector Engines", x=16, y=230, w=318, h=44, fontSize=16, fontWeight=700, fill="#0f172a"))
    nodes.append(node("text", parentId=c_art["id"], name="Excerpt", text="A comprehensive breakdown of canvas rendering, autolayout, and design tokens in client-side apps.", x=16, y=284, w=318, h=40, fontSize=12, fill="#475569"))
    nodes.append(node("ellipse", parentId=c_art["id"], name="Av", x=16, y=370, w=34, h=34, fill="#3b82f6"))
    nodes.append(node("text", parentId=c_art["id"], name="Author", text="Sarah Connor · Designer", x=60, y=378, w=220, h=18, fontSize=12, fontWeight=600, fill="#0f172a"))

    # Profile Card
    c_prof = node("frame", parentId=cards_section["id"], name="variant=Profile", component=True, isInstance=False, variant={"variant": "Profile"}, x=816, y=24, w=350, h=430, fill="#ffffff", radius=10, stroke="#e2e8f0", strokeWidth=1, shadow=True, shadowBlur=16, shadowOpacity=0.06)
    nodes.append(c_prof)
    nodes.append(node("rect", parentId=c_prof["id"], name="Banner", x=0, y=0, w=350, h=110, fill="#2563eb", radius=10))
    nodes.append(node("ellipse", parentId=c_prof["id"], name="Av", x=135, y=70, w=80, h=80, fill="#f8fafc", stroke="#ffffff", strokeWidth=4))
    nodes.append(node("text", parentId=c_prof["id"], name="Name", text="Nazmudin Alkhamil", x=0, y=164, w=350, h=22, fontSize=16, fontWeight=700, fill="#0f172a", textAlign="center"))
    nodes.append(node("text", parentId=c_prof["id"], name="Role", text="Senior Design Systems Lead", x=0, y=190, w=350, h=18, fontSize=12, fontWeight=600, fill="#2563eb", textAlign="center"))
    nodes.append(node("text", parentId=c_prof["id"], name="Bio", text="Architecting component libraries, design token specifications, and generative tools.", x=30, y=220, w=290, h=40, fontSize=12, fill="#64748b", textAlign="center"))
    b_fol = node("frame", parentId=c_prof["id"], name="Follow", x=30, y=366, w=290, h=44, fill="#0f172a", radius=8)
    nodes.append(b_fol)
    nodes.append(node("text", parentId=b_fol["id"], name="Txt", text="View Profile", x=0, y=13, w=290, h=18, fontSize=13, fontWeight=600, fill="#ffffff", textAlign="center"))

    # 4.2 Data Table Component
    tbl_box = node("frame",
        parentId=artboard["id"],
        name="Component/Table",
        component=True,
        isInstance=False,
        x=40, y=636, w=1200, h=320,
        fill="#ffffff",
        radius=12,
        stroke="#e2e8f0",
        strokeWidth=1,
        shadow=True,
        shadowBlur=12,
        shadowOpacity=0.04
    )
    nodes.append(tbl_box)

    # Header Row
    th = node("frame", parentId=tbl_box["id"], name="Table Header", x=0, y=0, w=1200, h=48, fill="#f8fafc", stroke="#e2e8f0", strokeWidth=1)
    nodes.append(th)
    nodes.append(node("text", parentId=th["id"], name="H1", text="DOCUMENT NAME", x=32, y=16, w=320, h=16, fontSize=11, fontWeight=700, fill="#64748b"))
    nodes.append(node("text", parentId=th["id"], name="H2", text="STATUS", x=400, y=16, w=160, h=16, fontSize=11, fontWeight=700, fill="#64748b"))
    nodes.append(node("text", parentId=th["id"], name="H3", text="AUTHOR", x=620, y=16, w=180, h=16, fontSize=11, fontWeight=700, fill="#64748b"))
    nodes.append(node("text", parentId=th["id"], name="H4", text="LAST MODIFIED", x=840, y=16, w=180, h=16, fontSize=11, fontWeight=700, fill="#64748b"))
    nodes.append(node("text", parentId=th["id"], name="H5", text="ACTIONS", x=1060, y=16, w=100, h=16, fontSize=11, fontWeight=700, fill="#64748b"))

    # Rows
    rows = [
        ("Midas Mobile Wireframe Kit", "Published", "Nazmudin", "2 mins ago"),
        ("E-Commerce Checkout Flow v2", "In Review", "Sarah Jane", "1 hour ago"),
        ("Design Tokens JSON Export", "Active", "Alex Rivera", "Yesterday"),
        ("Design Foundations & Colors", "Archived", "David K.", "3 days ago")
    ]
    for ri, (rname, rstat, rauth, rdate) in enumerate(rows):
        tr = node("frame", parentId=tbl_box["id"], name=f"Row_{ri+1}", x=0, y=48 + ri * 54, w=1200, h=54, fill="#ffffff", stroke="#f1f5f9", strokeWidth=1)
        nodes.append(tr)
        nodes.append(node("text", parentId=tr["id"], name="DocName", text=rname, x=32, y=18, w=340, h=18, fontSize=13, fontWeight=600, fill="#0f172a"))
        stat_col = "#16a34a" if rstat == "Published" else ("#2563eb" if rstat == "Active" else ("#d97706" if rstat == "In Review" else "#64748b"))
        nodes.append(node("text", parentId=tr["id"], name="Status", text=f"● {rstat}", x=400, y=18, w=160, h=18, fontSize=12, fontWeight=600, fill=stat_col))
        nodes.append(node("text", parentId=tr["id"], name="Author", text=rauth, x=620, y=18, w=180, h=18, fontSize=13, fill="#475569"))
        nodes.append(node("text", parentId=tr["id"], name="Date", text=rdate, x=840, y=18, w=180, h=18, fontSize=13, fill="#94a3b8"))
        nodes.append(node("text", parentId=tr["id"], name="Act", text="Edit · Share", x=1060, y=18, w=100, h=18, fontSize=12, fontWeight=600, fill="#2563eb"))

    # Pagination footer
    t_foot = node("frame", parentId=tbl_box["id"], name="Table Footer", x=0, y=264, w=1200, h=56, fill="#f8fafc")
    nodes.append(t_foot)
    nodes.append(node("text", parentId=t_foot["id"], name="Showing", text="Showing 1 to 4 of 28 entries", x=32, y=20, w=300, h=18, fontSize=12, fill="#64748b"))
    nodes.append(node("text", parentId=t_foot["id"], name="Next", text="Previous  ·  Next", x=1050, y=20, w=120, h=18, fontSize=12, fontWeight=600, fill="#2563eb", textAlign="right"))

    # 4.3 Lists, Accordions, Avatars
    bot_row = node("frame",
        parentId=artboard["id"],
        name="Lists, Accordion & Avatars",
        x=40, y=976, w=1200, h=480,
        fill="#ffffff",
        radius=12,
        stroke="#e2e8f0",
        strokeWidth=1,
        shadow=True,
        shadowBlur=12,
        shadowOpacity=0.04
    )
    nodes.append(bot_row)

    # Lists
    nodes.append(node("text", parentId=bot_row["id"], name="T_List", text="Formatted Checklists", x=24, y=24, w=240, h=20, fontSize=14, fontWeight=700, fill="#0f172a"))
    l_box = node("frame", parentId=bot_row["id"], name="Component/Lists", component=True, isInstance=False, x=24, y=56, w=340, h=390, fill="#f8fafc", radius=8)
    nodes.append(l_box)
    checklist = [
        ("✓", "ComponentSet & Variants enabled", True),
        ("✓", "Auto layout responsive constraints", True),
        ("✓", "Variables (Colors, Spacing, Radius)", True),
        ("✓", "5 Isolated categories on 5 pages", True),
        ("1.", "Inspect components in right panel", False),
        ("2.", "Switch variant states and sizes", False),
        ("3.", "Apply semantic tokens to nodes", False)
    ]
    for li, (bullet, text_str, is_check) in enumerate(checklist):
        nodes.append(node("text", parentId=l_box["id"], name=f"B_{li}", text=bullet, x=16, y=20 + li * 50, w=24, h=20, fontSize=14, fontWeight=700, fill="#16a34a" if is_check else "#2563eb"))
        nodes.append(node("text", parentId=l_box["id"], name=f"T_{li}", text=text_str, x=44, y=20 + li * 50, w=280, h=36, fontSize=13, fill="#334155"))

    # Accordions
    nodes.append(node("text", parentId=bot_row["id"], name="T_Acc", text="Interactive Accordion", x=396, y=24, w=240, h=20, fontSize=14, fontWeight=700, fill="#0f172a"))
    acc_set = node("frame", parentId=bot_row["id"], name="Accordion", x=396, y=56, w=400, h=390, fill="none", stroke="#9747ff", strokeWidth=1, strokeStyle="dash", componentSet=True, clip=False)
    nodes.append(acc_set)

    # Collapsed
    a_col = node("frame", parentId=acc_set["id"], name="state=collapsed", component=True, isInstance=False, variant={"state": "collapsed"}, x=16, y=16, w=368, h=52, fill="#f8fafc", radius=8, stroke="#e2e8f0", strokeWidth=1)
    nodes.append(a_col)
    nodes.append(node("text", parentId=a_col["id"], name="Q", text="How do Design Tokens work?", x=16, y=16, w=300, h=20, fontSize=13, fontWeight=600, fill="#0f172a"))
    nodes.append(node("text", parentId=a_col["id"], name="Icon", text="▼", x=336, y=16, w=16, h=16, fontSize=12, fill="#64748b"))

    # Expanded
    a_exp = node("frame", parentId=acc_set["id"], name="state=expanded", component=True, isInstance=False, variant={"state": "expanded"}, x=16, y=84, w=368, h=160, fill="#ffffff", radius=8, stroke="#cbd5e1", strokeWidth=1)
    nodes.append(a_exp)
    nodes.append(node("text", parentId=a_exp["id"], name="Q", text="How do Design Tokens work?", x=16, y=16, w=300, h=20, fontSize=13, fontWeight=700, fill="#2563eb"))
    nodes.append(node("text", parentId=a_exp["id"], name="Icon", text="▲", x=336, y=16, w=16, h=16, fontSize=12, fill="#2563eb"))
    nodes.append(node("text", parentId=a_exp["id"], name="Body", text="Design tokens define primitive and semantic values in collection stores. In Midas, tokens can be bound to nodes via node.vars and automatically resolve based on the active mode.", x=16, y=48, w=336, h=96, fontSize=12, lineHeight=1.45, fill="#475569"))

    # Avatar Matrix
    nodes.append(node("text", parentId=bot_row["id"], name="T_Av", text="Avatar Matrix", x=826, y=24, w=240, h=20, fontSize=14, fontWeight=700, fill="#0f172a"))
    av_set = node("frame", parentId=bot_row["id"], name="Avatar", x=826, y=56, w=350, h=390, fill="none", stroke="#9747ff", strokeWidth=1, strokeStyle="dash", componentSet=True, clip=False)
    nodes.append(av_set)

    av_sizes = [("xl", 64, 20, 16), ("lg", 48, 16, 96), ("md", 38, 13, 160), ("sm", 28, 11, 216)]
    for sz_name, sz, fsz, sy in av_sizes:
        # Initials with online
        av1 = node("frame", parentId=av_set["id"], name=f"size={sz_name}, type=initials, status=online", component=True, isInstance=False, variant={"size": sz_name, "type": "initials", "status": "online"}, x=16, y=sy, w=sz, h=sz, fill="#2563eb", radius=9999, clip=False)
        nodes.append(av1)
        nodes.append(node("text", parentId=av1["id"], name="Init", text="JD", x=0, y=(sz-fsz)//2 - 1, w=sz, h=fsz+4, fontSize=fsz, fontWeight=700, fill="#ffffff", textAlign="center"))
        nodes.append(node("ellipse", parentId=av1["id"], name="Dot", x=sz-8, y=0, w=8, h=8, fill="#22c55e", stroke="#ffffff", strokeWidth=2))

        # Icon with offline
        av2 = node("frame", parentId=av_set["id"], name=f"size={sz_name}, type=icon, status=none", component=True, isInstance=False, variant={"size": sz_name, "type": "icon", "status": "none"}, x=100, y=sy, w=sz, h=sz, fill="#475569", radius=9999, clip=False)
        nodes.append(av2)
        nodes.append(node("text", parentId=av2["id"], name="Ico", text="👤", x=0, y=(sz-fsz)//2 - 1, w=sz, h=fsz+4, fontSize=fsz, fill="#ffffff", textAlign="center"))

        # Label
        nodes.append(node("text", parentId=av_set["id"], name="Lbl", text=f"Size: {sz_name.upper()} ({sz}px)", x=180, y=sy + sz//2 - 8, w=150, h=16, fontSize=12, fontWeight=600, fill="#64748b"))

    return nodes

# =============================================================================
# PAGE 5: 05 · Feedback
# =============================================================================
def build_page_feedback():
    nodes = []
    artboard = node("frame",
        name="05 · Feedback",
        x=0, y=0, w=1280, h=1380,
        fill="#f8fafc",
        clip=False
    )
    nodes.append(artboard)
    add_page_header(nodes, artboard["id"], "05 · Feedback & System Status", "Alert Banners, Elevated Toast Notifications, Modal Dialog, and Loaders")

    # 5.1 Alert ComponentSet
    alert_section = node("frame",
        parentId=artboard["id"],
        name="Alert",
        x=40, y=136, w=1200, h=330,
        fill="#ffffff",
        radius=12,
        stroke="#9747ff",
        strokeWidth=1,
        strokeStyle="dash",
        strokeDash=6,
        strokeGap=4,
        componentSet=True,
        clip=False
    )
    nodes.append(alert_section)

    alerts = [
        ("success", "#f0fdf4", "#15803d", "#22c55e", "✔", "Library Synchronized", "Design system tokens and components were published to your active project."),
        ("info", "#eff6ff", "#1d4ed8", "#3b82f6", "ℹ", "Workspace Notice", "A new version of Midas UI kit is available for review."),
        ("warning", "#fffbeb", "#b45309", "#f59e0b", "⚠", "Unbound Properties", "Some instances contain overridden properties that have not been assigned to variables."),
        ("error", "#fef2f2", "#b91c1c", "#ef4444", "✖", "Save Failed", "Could not write to local storage quota. Please export your .midas backup file.")
    ]

    for ai, (atype, abg, afg, ast, aico, atitle, amsg) in enumerate(alerts):
        alt = node("frame",
            parentId=alert_section["id"],
            name=f"type={atype}",
            component=True,
            isInstance=False,
            variant={"type": atype},
            x=24, y=24 + ai * 72, w=1152, h=56,
            fill=abg,
            radius=8,
            stroke=ast,
            strokeWidth=1
        )
        nodes.append(alt)
        nodes.append(node("text", parentId=alt["id"], name="Icon", text=aico, x=20, y=18, w=20, h=20, fontSize=15, fontWeight=700, fill=afg))
        nodes.append(node("text", parentId=alt["id"], name="Title", text=atitle, x=50, y=18, w=180, h=20, fontSize=13, fontWeight=700, fill=afg))
        nodes.append(node("text", parentId=alt["id"], name="Msg", text=amsg, x=240, y=19, w=840, h=18, fontSize=13, fill=afg))
        nodes.append(node("text", parentId=alt["id"], name="Dismiss", text="✕", x=1116, y=18, w=20, h=20, fontSize=14, fill=afg))

    # 5.2 Modal Dialog & Toast Notifications
    mid_wrap = node("frame",
        parentId=artboard["id"],
        name="Modal & Toasts",
        x=40, y=490, w=1200, h=440,
        fill="#ffffff",
        radius=12,
        stroke="#e2e8f0",
        strokeWidth=1,
        shadow=True,
        shadowBlur=12,
        shadowOpacity=0.04
    )
    nodes.append(mid_wrap)

    # Modal Dialog Component
    nodes.append(node("text", parentId=mid_wrap["id"], name="T_Mod", text="Modal Dialog Component", x=24, y=24, w=300, h=20, fontSize=14, fontWeight=700, fill="#0f172a"))
    modal_comp = node("frame", parentId=mid_wrap["id"], name="Component/Modal", component=True, isInstance=False, x=24, y=56, w=640, h=350, fill="#0f172a", fillOpacity=0.45, radius=12)
    nodes.append(modal_comp)

    # Dialog Card inside modal
    card = node("frame", parentId=modal_comp["id"], name="Dialog Card", x=80, y=35, w=480, h=280, fill="#ffffff", radius=12, shadow=True, shadowBlur=24, shadowOpacity=0.2)
    nodes.append(card)
    nodes.append(node("text", parentId=card["id"], name="Title", text="Publish Design Tokens", x=24, y=24, w=380, h=24, fontSize=18, fontWeight=700, fill="#0f172a"))
    nodes.append(node("text", parentId=card["id"], name="Close", text="✕", x=436, y=24, w=20, h=20, fontSize=16, fill="#64748b"))
    nodes.append(node("text", parentId=card["id"], name="Body", text="Are you sure you want to publish these 59 tokens and 48 button variants to team workspaces? This action updates semantic references across all opened documents.", x=24, y=68, w=432, h=68, fontSize=13, lineHeight=1.45, fill="#475569"))

    c_btn = node("frame", parentId=card["id"], name="Cancel", x=230, y=214, w=100, h=40, fill="#f1f5f9", radius=8)
    nodes.append(c_btn)
    nodes.append(node("text", parentId=c_btn["id"], name="T", text="Cancel", x=0, y=11, w=100, h=18, fontSize=13, fontWeight=600, fill="#475569", textAlign="center"))

    cf_btn = node("frame", parentId=card["id"], name="Confirm", x=342, y=214, w=114, h=40, fill="#2563eb", radius=8)
    nodes.append(cf_btn)
    nodes.append(node("text", parentId=cf_btn["id"], name="T", text="Publish", x=0, y=11, w=114, h=18, fontSize=13, fontWeight=600, fill="#ffffff", textAlign="center"))

    # Toast Notifications ComponentSet
    nodes.append(node("text", parentId=mid_wrap["id"], name="T_Toast", text="Toast Notifications", x=700, y=24, w=300, h=20, fontSize=14, fontWeight=700, fill="#0f172a"))
    toast_set = node("frame", parentId=mid_wrap["id"], name="Toast", x=700, y=56, w=476, h=350, fill="#f8fafc", radius=8, stroke="#9747ff", strokeWidth=1, strokeStyle="dash", componentSet=True, clip=False)
    nodes.append(toast_set)

    toasts = [
        ("success", "#16a34a", "Design Kit Loaded", "All 5 categories have been imported into the document."),
        ("error", "#dc2626", "Connection Lost", "LocalStorage quota limit reached. Please clean up old files."),
        ("info", "#2563eb", "Workspace Backup", "Auto-save completed locally 2 seconds ago.")
    ]
    for ti, (ttype, tcol, thead, tbody) in enumerate(toasts):
        t_card = node("frame",
            parentId=toast_set["id"],
            name=f"type={ttype}",
            component=True,
            isInstance=False,
            variant={"type": ttype},
            x=24, y=24 + ti * 100, w=428, h=76,
            fill="#1e293b",
            radius=10,
            shadow=True,
            shadowBlur=16,
            shadowOpacity=0.2
        )
        nodes.append(t_card)
        nodes.append(node("rect", parentId=t_card["id"], name="Bar", x=0, y=0, w=5, h=76, fill=tcol, radius=4))
        nodes.append(node("text", parentId=t_card["id"], name="Heading", text=thead, x=20, y=16, w=350, h=18, fontSize=13, fontWeight=700, fill="#ffffff"))
        nodes.append(node("text", parentId=t_card["id"], name="Text", text=tbody, x=20, y=38, w=380, h=20, fontSize=12, fill="#94a3b8"))
        nodes.append(node("text", parentId=t_card["id"], name="X", text="✕", x=396, y=16, w=16, h=16, fontSize=12, fill="#64748b"))

    # 5.3 Tooltips, Progress, Spinner & Skeleton
    bot_wrap = node("frame",
        parentId=artboard["id"],
        name="Tooltips & Loaders",
        x=40, y=956, w=1200, h=380,
        fill="#ffffff",
        radius=12,
        stroke="#e2e8f0",
        strokeWidth=1,
        shadow=True,
        shadowBlur=12,
        shadowOpacity=0.04
    )
    nodes.append(bot_wrap)

    # Tooltips
    nodes.append(node("text", parentId=bot_wrap["id"], name="T_TT", text="Tooltips & Badges", x=24, y=24, w=300, h=20, fontSize=14, fontWeight=700, fill="#0f172a"))
    tt_box = node("frame", parentId=bot_wrap["id"], name="Component/Tooltip", component=True, isInstance=False, x=24, y=56, w=340, h=290, fill="#f8fafc", radius=8)
    nodes.append(tt_box)

    tt1 = node("frame", parentId=tt_box["id"], name="Tooltip Dark", x=40, y=40, w=220, h=34, fill="#0f172a", radius=6)
    nodes.append(tt1)
    nodes.append(node("text", parentId=tt1["id"], name="Txt", text="Quick Actions (⌘K)", x=0, y=8, w=220, h=16, fontSize=12, fontWeight=500, fill="#ffffff", textAlign="center"))

    tt2 = node("frame", parentId=tt_box["id"], name="Tooltip Primary", x=40, y=110, w=220, h=34, fill="#2563eb", radius=6)
    nodes.append(tt2)
    nodes.append(node("text", parentId=tt2["id"], name="Txt", text="Component Set: 48 Variants", x=0, y=8, w=220, h=16, fontSize=12, fontWeight=500, fill="#ffffff", textAlign="center"))

    tt3 = node("frame", parentId=tt_box["id"], name="Tooltip White", x=40, y=180, w=220, h=34, fill="#ffffff", radius=6, stroke="#cbd5e1", strokeWidth=1, shadow=True, shadowBlur=8, shadowOpacity=0.1)
    nodes.append(tt3)
    nodes.append(node("text", parentId=tt3["id"], name="Txt", text="Click to edit token mode", x=0, y=8, w=220, h=16, fontSize=12, fontWeight=600, fill="#0f172a", textAlign="center"))

    # Loaders & Skeletons
    nodes.append(node("text", parentId=bot_wrap["id"], name="T_Prog", text="Progress Bars & Skeleton Loaders", x=390, y=24, w=300, h=20, fontSize=14, fontWeight=700, fill="#0f172a"))
    prog_comp = node("frame", parentId=bot_wrap["id"], name="Component/Progress", component=True, isInstance=False, x=390, y=56, w=786, h=290, fill="#f8fafc", radius=8)
    nodes.append(prog_comp)

    # Progress bar
    nodes.append(node("text", parentId=prog_comp["id"], name="L_PB", text="Syncing Assets · 72%", x=24, y=20, w=200, h=18, fontSize=13, fontWeight=600, fill="#0f172a"))
    pbg = node("frame", parentId=prog_comp["id"], name="Bar BG", x=24, y=48, w=738, h=12, fill="#e2e8f0", radius=9999)
    nodes.append(pbg)
    nodes.append(node("frame", parentId=pbg["id"], name="Bar Fill", x=0, y=0, w=530, h=12, fill="#2563eb", radius=9999))

    # Spinner
    spin_box = node("frame", parentId=prog_comp["id"], name="Spinner Box", x=24, y=86, w=240, h=40, fill="none")
    nodes.append(spin_box)
    nodes.append(node("ellipse", parentId=spin_box["id"], name="Ring", x=0, y=6, w=28, h=28, fill="none", stroke="#2563eb", strokeWidth=3, strokeStyle="dash", strokeDash=12, strokeGap=6))
    nodes.append(node("text", parentId=spin_box["id"], name="Txt", text="Rendering vector nodes…", x=40, y=11, w=190, h=18, fontSize=13, fill="#64748b"))

    # Skeleton cards
    for si in range(2):
        sk = node("frame", parentId=prog_comp["id"], name=f"Skeleton {si+1}", x=24 + si * 380, y=148, w=360, h=110, fill="#ffffff", radius=8, stroke="#e2e8f0", strokeWidth=1)
        nodes.append(sk)
        nodes.append(node("ellipse", parentId=sk["id"], name="Skel Av", x=16, y=28, w=54, h=54, fill="#e2e8f0"))
        nodes.append(node("rect", parentId=sk["id"], name="Line 1", x=86, y=28, w=240, h=16, fill="#e2e8f0", radius=4))
        nodes.append(node("rect", parentId=sk["id"], name="Line 2", x=86, y=52, w=180, h=12, fill="#f1f5f9", radius=4))
        nodes.append(node("rect", parentId=sk["id"], name="Line 3", x=86, y=72, w=120, h=10, fill="#f1f5f9", radius=4))

    return nodes

def generate():
    pages_meta = [
        ("01 · Atoms", build_page_atoms),
        ("02 · Forms", build_page_forms),
        ("03 · Navigation", build_page_navigation),
        ("04 · Data Display", build_page_data_display),
        ("05 · Feedback", build_page_feedback)
    ]

    pages = []
    total_nodes = 0
    first_page_id = None

    for title, builder_fn in pages_meta:
        pid = uid("page")
        if first_page_id is None:
            first_page_id = pid
        p_nodes = builder_fn()
        total_nodes += len(p_nodes)
        pages.append({
            "id": pid,
            "name": title,
            "nodes": p_nodes
        })

    variables = build_variables()

    doc = {
        "format": "midas",
        "version": 1,
        "name": "Midas Design System",
        "pageId": first_page_id,
        "pages": pages,
        "tokens": {
            "colors": [
                {"name": "Blue 500", "value": "#3b82f6"},
                {"name": "Blue 600", "value": "#2563eb"},
                {"name": "Gray 900", "value": "#0f172a"},
                {"name": "Gray 50", "value": "#f8fafc"},
                {"name": "Green 500", "value": "#22c55e"},
                {"name": "Red 500", "value": "#ef4444"}
            ],
            "typography": [
                {"name": "H1 / Display", "size": 36, "weight": 700, "lineHeight": 1.2},
                {"name": "H2 / Title", "size": 24, "weight": 700, "lineHeight": 1.25},
                {"name": "H3 / Section", "size": 18, "weight": 600, "lineHeight": 1.3},
                {"name": "Body / Regular", "size": 14, "weight": 400, "lineHeight": 1.45},
                {"name": "Body / Medium", "size": 14, "weight": 500, "lineHeight": 1.45},
                {"name": "Label / Small", "size": 11, "weight": 600, "lineHeight": 1.3}
            ]
        },
        "assets": {},
        "variables": variables
    }

    out_file = "design-system.json"
    public_file = "public/design-system.json"

    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=2)

    with open(public_file, "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=2)

    print(f"Generated {out_file} and {public_file} successfully.")
    print(f"Total pages: {len(pages)}")
    print(f"Total nodes across all pages: {total_nodes}")
    print(f"Total variable collections: {len(variables['collections'])}, items: {len(variables['items'])}")

if __name__ == "__main__":
    generate()
