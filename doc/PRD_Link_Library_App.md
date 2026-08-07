# Product Requirements Document: Link Library App

**Version:** 1.0 (Draft)
**Status:** For review
**Date:** 2026-08-07

---

## 1. Overview

### 1.1 Purpose
A simple, fast, and robust internal application for cataloguing and discovering links (Canva, Google Drive, and other web resources). The core value is **findability** — helping people quickly locate the right resource through search and browsing, rather than hunting through scattered folders, chats, or bookmarks.

### 1.2 Goals
- Fast, simple, easy-to-navigate interface
- Reliable search across titles, descriptions, tags, and link labels
- Clear ownership and permission model across three roles
- Lightweight enough to run on SQLite, robust enough for ~100s of users

### 1.3 Non-goals (v1)
- Public/external access (internal tool only, VPS-hosted)
- SSO / third-party auth (email + password only)
- Automatic link content preview/thumbnail fetching
- Approval workflows for publishing entries

---

## 2. Users & Roles

| Role | Description |
|---|---|
| **User** | Can create entries, edit/soft-delete their own entries only. Can browse, search, and favorite any entry. |
| **Curator** | Can view, edit, and soft-delete **all** entries regardless of owner. Same browsing/search/favorite abilities as User. |
| **Admin** | Full curator abilities, plus user management, division management, hard-delete, and access to the admin dashboard (including broken-link status). |

### 2.1 Permission Matrix

| Action | User | Curator | Admin |
|---|:---:|:---:|:---:|
| Browse / search entries | ✅ | ✅ | ✅ |
| Favorite entries | ✅ | ✅ | ✅ |
| Create entry | ✅ | ✅ | ✅ |
| Edit own entry | ✅ | ✅ | ✅ |
| Edit others' entries | ❌ | ✅ | ✅ |
| Soft-delete (archive) own entry | ✅ | ✅ | ✅ |
| Soft-delete others' entries | ❌ | ✅ | ✅ |
| Hard-delete (permanent) | ❌ | ❌ | ✅ |
| Manage users (create/deactivate/assign role) | ❌ | ❌ | ✅ |
| Manage divisions | ❌ | ❌ | ✅ |
| View admin dashboard (broken-link status, etc.) | ❌ | ❌ | ✅ |
| Mark a link as protected | ❌ | ✅ | ✅ |
| See/search protected links | ❌ | ✅ | ✅ |

### 2.2 Notes
- **Division** is a label on the user record only (used for admin reporting/user management). It does **not** scope entry visibility — the entry library is fully shared; every role sees and searches all entries.
- When a user account is deactivated, their entries **remain as-is** (not reassigned, not hidden).
- Soft-deleted entries are recoverable (by curator/admin); hard-delete is permanent and admin-only.
- **Protected links**: visibility is a **per-link** property, not per-entry (see §3.3 and §4.1.1). Only curator and admin roles can mark a link as protected, and only curator/admin can see or search protected links. Entries created by the User role can never contain a protected link — the protection option simply isn't available to them.

---

## 3. Data Model

### 3.1 Core entities

**users**
- id, name, email, password_hash, role (`admin` / `curator` / `user`), division_id, status (`active` / `deactivated`), created_at

**divisions**
- id, name, description

**entries** *(the searchable unit — one entry can hold multiple links)*
- id, title, description, category_id, created_by (user_id), status (`active` / `archived` / `deleted`), view_count, created_at, updated_at

**entry_links** *(one-to-many with entries)*
- id, entry_id, url, label (short, e.g. "Main design file"), source_type (`canva` / `gdrive` / `other`), sort_order, link_status (`ok` / `broken` / `unchecked`), last_checked_at, visibility (`public` / `protected`), created_at

**categories**
- id, name

**tags**
- id, name

**entry_tags** (many-to-many)
- entry_id, tag_id

**favorites**
- user_id, entry_id, created_at

### 3.2 Key relationships
- An entry has exactly **one category**, **one or more tags**, and **one or more links**.
- Each link belongs to exactly one entry, has its own label and source type, and supports manual reordering via `sort_order`.
- A minimum of **1 link is required** to save an entry.

### 3.3 Link visibility (protected links)
- `visibility` defaults to `public` for every link.
- Only **curator** and **admin** roles have the option to set a link's visibility to `protected` when creating or editing a link.
- Links added by the **User** role are always `public` — the field is not exposed in their entry-creation UI.
- One entry can freely mix public and protected links (e.g. a public Canva design link alongside a protected internal Gdrive folder link within the same entry).

---

## 4. Features

### 4.1 Entry management
- Create/edit entry: title, description, category (single-select), tags (multi, free-form with autocomplete/reuse of existing tags), one or more links (each with URL + label + source type).
- **Duplicate URL detection**: when adding a link, check if the URL already exists anywhere in the library; warn the user and show the existing entry before they proceed.
- Manual reordering of links within an entry (drag-to-reorder), defaulting to add-date order if untouched.
- Soft delete (archive) vs hard delete (admin only), per permission matrix above.

#### 4.1.1 Protected links
- In the entry **create** and **edit** forms, curator/admin see a **"Protected"** toggle next to each link field (off by default). Turning it on restricts that specific link to curator/admin visibility. This means a curator/admin can protect a link at creation time, or go back and protect/unprotect a link on an existing entry at any time via edit — including entries that were originally created by a User (per §2.2, permission to edit others' entries already belongs to curator/admin).
- The User role never sees this toggle, on either create or edit of their own entries.
- When a **User** views an entry that contains a mix of public and protected links, they see only the public links; the protected ones are omitted entirely from their view (not shown as locked/greyed-out placeholders — they simply don't appear, so their existence isn't revealed).
- If **all** links in an entry are protected, the User role does not see the entry at all in search or browse results.
- Curators and admins see all links (public and protected) with a visible "Protected" badge, so they know at a glance which links are restricted.

### 4.2 Search
- Single search bar as the primary entry point.
- Indexes: entry title, description, tags, and all link labels within the entry (via SQLite FTS5). Raw URLs are **not** indexed/searchable.
- Results are **ranked by relevance**, not just filtered.
- A search returns the **entry** once (not duplicated per link).
- **Visibility enforcement**: search results and match ranking are computed per the requesting user's role. For the User role, protected link labels are excluded from the searchable index results they can match against, and entries that are entirely made up of protected links are excluded from their results altogether (per §4.1.1). Curator/admin search is unrestricted.

### 4.3 Browse mode
- Alternative to search, for users who don't know exactly what they're looking for.
- Browse by **category** and by **tag cloud** (most-used tags surfaced).
- Sortable by relevance/popularity (view count) or recency.
- Same visibility rules as search apply: Users never see protected links or entries made up entirely of protected links; curators/admins see everything.

### 4.4 Favorites
- Any user can favorite/bookmark any entry for quick personal access, separate from the shared library.

### 4.5 View tracking
- Each entry tracks a **view count**, incremented when opened. Supports popularity-based sorting/browsing and gives curators/admins usage signal.

### 4.6 Admin dashboard
- User management: create, deactivate, edit role/division.
- Division management: create/edit/remove divisions.
- **Broken-link status**: periodic automated check of all `entry_links` URLs; dashboard shows count/list of broken links (`link_status = broken`) with last-checked timestamp, so admins/curators can follow up. (Not shown to regular users.)

---

## 5. Non-Functional Requirements

- **Database**: SQLite with FTS5 extension for full-text search.
- **Hosting**: Self-hosted on VPS, internal tool (no public internet requirement).
- **Auth**: Email + password (no SSO in v1).
- **Scale assumption**: designed for low hundreds of users and a growing entry count in the low thousands; pagination should use keyset (cursor-based) pagination rather than offset pagination to stay fast as the library grows.
- **Performance target**: search results and page navigation should feel instant (sub-300ms typical query time) given the target scale.

---

## 6. Deferred / Future Considerations (out of scope for v1)

- Auto-fetch title/thumbnail preview when pasting a URL
- Approval workflow for new entries
- Division-based visibility scoping (if requirements change later)
- SSO / Google auth (relevant given Gdrive is a core link type)
- Export/reporting tools beyond the basic admin dashboard

---

## 7. Open Questions for Stakeholder Review

1. Should the **broken-link checker** attempt a lightweight HEAD/GET request, and how often should it run (e.g. daily/weekly)? Needs an operational cadence decision.
2. Should **categories** be manageable only by admin, or also by curators?
3. Is there a need for **bulk actions** (e.g. bulk-tag, bulk-archive) for curators/admins managing large numbers of entries?
4. Any **branding/visual identity** requirements, or is a clean, minimal default UI acceptable for v1?
5. For **protected links**: should a User ever be told an entry has "additional restricted content" (so they know to ask a curator), or should protected links be completely invisible/unhinted, as currently specified in §4.1.1?
6. Should **favorites** be blocked for protected links from the User's side, or is this moot since Users can't see protected links to favorite them in the first place (i.e. no special handling needed)?

---

*End of draft. Please review Section 7 and confirm before moving to technical design / wireframes.*
