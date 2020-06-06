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
  'sd-auth',
  'neodarwin',
  'sd-gimme-db',
  'hegemone',
  'po-intake',
  'sd-ads',
  'sd-traductor',
  'word-of-the-day',
  'sd-e2e-tests',
];

const basePath = path.join(expandTilde('~'), '/scm/sd');

function notify(str, opts = { padRight: 0, newline: false, isError: false }) {
  if (opts.newline) str += '\n';
  str = pad(str, opts.padRight, ' ');
  const outstream = opts.isError ? process.stderr : process.stdout;
  outstream.write(str);
}

function startOp(opStr) {
  notify(`${opStr} `);
}

function doneOp() {
  notify('✓ ');
}

async function updateBranch(g, branchName) {
  startOp('⏩');
  await g.checkout(branchName);
  await g.pull();
  doneOp();
}

async function behind(g, branchName) {
  const cmd = `rev-list --left-only --count origin/${branchName}...${branchName}`.split(
    ' '
  );
  const result = await g.raw(cmd);
  if (/fatal|error/i.test(result)) throw new Error(result);
  return parseInt(result.trim(), 10);
}

async function syncBranch(g, branchName, numBehind) {
  startOp(`⏩︎ (${numBehind} behind)`);
  const cmds = [
    'checkout --quiet --detach',
    `fetch origin ${branchName}:${branchName}`,
    'checkout --quiet -',
  ];
  let errorFetching;
  for (const cmd of cmds) {
    let result;
    try {
      result = await g.raw(cmd.split(' '));
    } catch (ex) {
      result = ex;
    }
    if (
      /fatal: ambiguous argument .+?: unknown revision or path not in the working tree./.test(
        result
      )
    ) {
      // not tracking branch of same name
      return;
    }
    if (/fatal|error/i.test(result)) {
      // faux-finally :)
      errorFetching = new Error(result);
    }
  }
  if (errorFetching) throw errorFetching;
  doneOp();
}

async function main() {
  // TODO compute this
  const longestNameLength = 18;
  for (const repo of repos) {
    notify(`${repo}: `, { padRight: longestNameLength });
    const g = git(path.join(basePath, repo)).silent(true);
    await g.fetch();

    const originalStatus = await g.status();
    const originalBranch = originalStatus.current;

    const branches = [originalBranch];
    if (originalBranch !== 'master') {
      branches.unshift('master');
    }

    for (const branch of branches) {
      notify(`${branch} `);
      try {
        // let status;
        // if (branch !== originalBranch) {
        //   await g.checkout(branch);
        //   status = await g.status();
        // } else {
        //   status = originalStatus;
        // }

        // if (!status.tracking) continue;

        // Only works with branches that track branches with the same name:
        const numBehind = await behind(g, branch);
        if (numBehind > 0) {
          // await updateBranch(g, branch);
          await syncBranch(g, branch, numBehind);
        } else {
          doneOp();
        }
      } catch (ex) {
        notify(ex, { isError: true });
        // await restore(g);
      }
    }
    // await g.checkout(originalBranch);
    notify('', { newline: true });
  }
}

main();
