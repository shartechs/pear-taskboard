# Pear P2P Taskboard

Peer-to-peer Trello-style task board built as a Pear desktop app.  
Users create or join rooms by shared topic key and collaboratively manage tasks across three columns: **To Do**, **In Progress**, and **Done**. Tasks sync in real time with connected peers.

`The Project was started and tested on Windows platform only`

## Features

- Peer-to-peer synchronization via `hyperswarm`
- Room creation / join by topic keys
- Three status columns (drag-and-drop with SortableJS): To Do, In Progress, Done
- Add tasks with title and description
- Live search (title or creation date)
- Delete tasks
- Lightweight, no build step required (vanilla JS + vendored SortableJS)
- Simple UI optimized for quick collaboration in Pear

## How to run

[Pear](https://docs.pears.com/guides/getting-started) is a prerequisite, which can be installed with `npm i -g pear`.

```
$ git clone https://github.com/shartechs/pear-taskboard.git
$ cd pear-taskboard
$ npm install
$ pear run .
```

## How to test peer to peer

Open two app instances by running pear run --dev . in two terminals.

In the first app, click on Create. A random topic will appear at the top.

Note that topics consist of 64 hexadecimal characters (32 bytes).

Paste the topic into the second app, then click on Join.

Once connected, todos can be synchronized between each todo application.

## How to release

When a Pear app is released, it can be run by others. Read more about this in this [guide](https://docs.pears.com/guides/sharing-a-pear-app). The details won't be in this section, but just commands to run.

```
$ pear stage foo    # Stage the local version to a key called "foo"
$ pear release foo  # Release the staged version of "foo"
$ pear seed foo     # Start seeding (sharing) the app
```

When running `pear seed` there will be output similar to

```
-o-:-
    pear://a1b2c3...
...
^_^ announced
```

This link can be shared with others.

To run the app, do this (in another terminal):

```
$ pear run pear://a1b2c3...
```
