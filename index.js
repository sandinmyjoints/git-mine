#!/usr/bin/env node
/*eslint no-console: 0*/

/*
for each repo
- fetch from origin
- is origin/branch ahead? if yes,
- is it currently on master? if yes,
  - is origin/master ahead? if yes,
- if yes:
  - if not clean
  - if origin/master is ahead, then do git pull

TODO
- handle dirty working tree
- handle being ahead of master
- repos from config (cosmicconfig?)
- concurrency

*/

const path = require('path');
const expandTilde = require('expand-tilde');
const git = require('simple-git/promise');
const pad = require('pad-right');

// dir names
const repos = [
  'sd-router',
  'sd-playground',
  'atalanta',
  'darwin',
  'sd-auth',
  'neodarwin',
  'sd-gimme-db',
  'sd-traductor',
  'hegemone',
  'word-of-the-day',
];
const basePath = path.join(expandTilde('~'), '/scm/sd');

function notify(str, opts = { padRight: 0, newline: false }) {
  if (opts.newline) str += '\n';
  str = pad(str, opts.padRight, ' ');
  process.stdout.write(str);
}

function startOp(opStr) {
  notify(`${opStr}: `);
}

function doneOp() {
  notify('✓ ');
}

async function updateBranch(g, branchName) {
  try {
    let msg = branchName;
    if (!g.isNotFirst) {
      msg = `updating ${branchName}`;
      g.isNotFirst = true;
    }
    startOp(msg);
    await g.checkout(branchName);
    await g.pull();
    doneOp();
  } catch (err) {
    notify('󠁿❌ ');
    console.error(err);
  }
}

async function main() {
  // TODO compute this
  const longestNameLength = 18;
  for (const repo of repos) {
    notify(`${repo}: `, { padRight: longestNameLength });
    const g = git(path.join(basePath, repo));

    const originalStatus = await g.status();
    const originalBranch = originalStatus.current;

    const branches = [originalBranch];
    if (originalBranch !== 'master') {
      branches.unshift('master');
    }

    for (const branch of branches) {
      let status;
      if (branch !== originalBranch) {
        g.checkout(branch);
        status = await g.status();
      } else {
        status = originalStatus;
      }

      if (!status.tracking) continue;
      if (status.behind > 0) {
        await updateBranch(g, branch);
      } else {
        notify(`${branch} ✓ `);
      }
    }
    g.checkout(originalBranch);
    notify('done', { newline: true });
  }
}

main();
