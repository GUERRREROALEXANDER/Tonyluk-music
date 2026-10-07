# Tony Luk Music

A web music player whose playlists are built on a hand-written **doubly linked list** in TypeScript.

Tony Luk Music is named after Tony (a golden retriever) and Lucky (a white dog). Their warm gold, cream and white tones shape the whole visual identity.

> **Status:** in active development. The data structure, playback engines and services are done and tested. The new frontend is being built phase by phase (see [Roadmap](#roadmap)).

## Academic objective

University assignment on **doubly linked lists** applied to a real, working music player. The playlist is not an array: every song lives in a node with `prev` and `next` pointers. The player moves through the songs by following those pointers.

Required operations, all available from the interface:

| Operation | List method | Complexity |
|---|---|---|
| Add song at the beginning | `addFirst(song)` | O(1) |
| Add song at the end | `addLast(song)` | O(1) |
| Add song at any position | `insertAt(index, song)` | O(n) |
| Delete a song | `delete(node)` / `removeAt(index)` | O(1) / O(n) |
| Next song | `current = current.next` | O(1) |
| Previous song | `current = current.prev` | O(1) |

## Doubly Linked List

### The pieces

```ts
class ListNode<T> {        // SongNode = ListNode<Song>
  value: T;                // the song
  prev: ListNode<T> | null;
  next: ListNode<T> | null;
}

class DoublyLinkedList<T> {
  head: ListNode<T> | null;     // first node
  tail: ListNode<T> | null;     // last node
  current: ListNode<T> | null;  // the song that is playing
  size: number;                 // also exposed as `length`
}
```

Source: [`src/core/doublylinked.ts`](src/core/doublylinked.ts). The `Song` type and the `SongNode` alias live in [`src/core/song.ts`](src/core/song.ts).

### Shape of the list

```
null <- Song A <-> Song B <-> Song C -> null
        ^head                ^tail
```

- `head.prev` is always `null` and `tail.next` is always `null`.
- For every node `n` with a next node: `n.next.prev === n`.
- In an empty list, `head`, `tail` and `current` are all `null` and `size` is `0`.
- In a one-song list, `head === tail` and that node has `prev = next = null`.

### Add First

```
before:            head
                    v
           null <- [B] <-> [C] -> null

addFirst(A):  new.next = head;  head.prev = new;  head = new

after:     null <- [A] <-> [B] <-> [C] -> null
```

If the list was empty, the new node becomes both `head` and `tail`.

### Add Last

Mirror of Add First using `tail`: `new.prev = tail; tail.next = new; tail = new`.

### Insert At (position `i`)

1. `i === 0` → Add First. `i === size` → Add Last. Out of range → `RangeError`.
2. Otherwise find the node currently at `i` (walking from the closest end, so at most `n/2` steps).
3. Link the new node between that node and its `prev`:

```
[P] <-> [X]            new.prev = P;  new.next = X
            ==>        P.next = new;  X.prev = new
[P] <-> [new] <-> [X]
```

### Delete

```
[P] <-> [X] <-> [N]    P.next = N;  N.prev = P;  X.prev = X.next = null
            ==>
[P] <-> [N]
```

- Deleting the `head` moves `head` to `N`. Deleting the `tail` moves `tail` to `P`.
- If the deleted node was `current`, `current` moves to `N`, else to `P`, else becomes `null` (the list is now empty).

### Next and Previous: how the player uses the pointers

The player ([`src/core/player.ts`](src/core/player.ts)) keeps its position in the list's `current` pointer:

```ts
next():  current = current.next   // null at the tail → stop (or wrap to head with Repeat All)
prev():  current = current.prev   // null at the head → stop (or wrap to tail with Repeat All)
```

Both are **O(1)**: the player never searches the list, it only follows a pointer. This is why a *doubly* linked list is used: with a singly linked list, going back would need a walk from `head` (O(n)).

Extra behaviour built on top:

- **Repeat One** returns the same `current`.
- **Repeat All** wraps `tail → head` and `head → tail`.
- **Shuffle** uses a shuffled "bag" of node references with a history, so Previous returns to the song you actually heard.
- **Previous after 3 seconds** restarts the current song instead of moving back, like most players.

### Traversal

```ts
for (const node of list.traverseForward())  { /* head → tail via next */ }
for (const node of list.traverseBackward()) { /* tail → head via prev */ }
```

### Tests

`test/playlist.test.mjs`, `test/doublylinked.test.mjs` and `test/player*.test.mjs` cover: the empty list, a one-node list, add first/last, insert at 0 / middle / end, invalid positions, delete head/tail/middle, `current` repair, next/prev at both ends, wrap-around, and forward/backward traversal.

## Features

- Playlists, each one its own doubly linked list.
- Music sources:
  - **YouTube**: full songs through the official YouTube IFrame Player API.
  - **Spotify**: tracks through the official Spotify Embed iFrame API.
  - **iTunes catalog**: 30-second previews with artwork.
  - **Internet Archive**: Creative Commons music.
  - **Local audio files**: kept in IndexedDB so they survive a reload.
- Synced lyrics from [LRCLIB](https://lrclib.net), with the current line highlighted.
- Accounts (register, login, logout), favorites, recently played and saved preferences.
- Shuffle, repeat one and repeat all, volume, mute, seek, and Media Session keys.

## Technologies

- **TypeScript** (strict). The core logic and the UI are plain TypeScript classes and modules, with no framework.
- **HTML + CSS** with design tokens and a motion system that respects `prefers-reduced-motion`.
- **Node.js**: a zero-dependency dev server, plus serverless functions for search (Vercel).
- **Tests**: `node:test`, and `jsdom` for UI tests.

## Getting started

Requirements: Node.js 20+.

```bash
npm install
npm run dev        # compiles TypeScript and serves http://localhost:8000
npm test           # compiles and runs the test suite
```

### Environment variables

Copy `.env.example` to `.env`. Every variable is optional and the app works without them:

| Variable | Used for | Without it |
|---|---|---|
| `YOUTUBE_API_KEY` | YouTube search through the YouTube Data API v3 | Falls back to public Piped instances |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Spotify catalog search | Spotify tracks can still be added by pasting a link |
| `ALLOWED_ORIGIN` | CORS origin of the API functions | `*` |
| `PORT` | Local dev server port | `8000` |

Secrets are only read on the server (`api/`). They are never sent to the browser.

## Project structure

```
src/
  core/        doublylinked.ts, player.ts, library.ts, song.ts   ← data structure + player logic
  services/    itunes, youtube, spotify, lyrics, auth, userData, links, archive, idb, config
  playback/    engines.ts (audio / YouTube / Spotify), controller.ts
  ui/          new frontend (in progress)
api/           serverless functions: youtube-search, spotify-search
server/        dev.mjs: local static server + API router
assets/brand/  Tony Luk Music logo and artwork
test/          node:test suites
```

## Known limitations

- **Accounts are local to the browser.** There is no database: passwords are hashed with PBKDF2 (Web Crypto) and stored in `localStorage`. This is enough for the academic demo, but it is not a real server-side authentication system.
- **Spotify** plays full tracks only when the user is logged in to Spotify in the same browser; otherwise the embed plays 30-second previews. The Spotify embed does not allow volume control.
- **iTunes** results are 30-second previews.
- **YouTube without an API key** depends on public Piped instances, which are sometimes offline.

## Roadmap

- [x] Doubly linked list core with `current`, traversal and tests
- [x] Playback engines (audio, YouTube, Spotify), controller, lyrics, accounts, search API
- [ ] Design system and animated sign-in screen with Tony & Lucky
- [ ] Player dock, Now Playing with lyrics, "The Chain" list visualization, list operations
- [ ] Home, search, favorites, recently played, profile
- [ ] Responsive and accessibility pass, deployment

## Credits

- Base logic adapted from the open project [Linked Beats](https://github.com/nik129linux/linked-beats) by nik129linux. Tony Luk Music reuses its list, player and service modules and replaces the whole interface.
- Lyrics by [LRCLIB](https://lrclib.net). Music previews and artwork by the iTunes Search API.
