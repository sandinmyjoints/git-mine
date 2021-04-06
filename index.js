#!/usr/bin/env node
/*eslint no-console: 0*/
const chunk = require('lodash.chunk');

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
  // 'neodarwin',
  'sd-router',
  'sd-playground',
  'atalanta',
  'sd-auth',
  'sd-gimme-db',
  'hegemone',
  'po-intake',
  'sd-ads',
  'sd-traductor',
  'word-of-the-day',
  'sd-e2e-tests',
  'sd-vocab-e2e',
  'pn-logging',
  'sd-classroom-e2e',
];

const reposUsingMain = [
  'sd-vocab-e2e'
]

const basePath = path.join(expandTilde('~'), '/scm/sd');

function write(str) {
  // const outstream = opts.isError ? process.stderr : process.stdout;
  const outstream = process.stdout;
  outstream.write(str);
}

function notify(str, opts = { padRight: 0, newline: false, isError: false }) {
  if (opts.newline) str += '\n';
  str = pad(str, opts.padRight, ' ');
  return str;
}

async function behind(g, branchName) {
  const cmd = `rev-list --left-only --count origin/${branchName}...${branchName}`.split(
    ' '
  );
  const result = await g.raw(cmd);
  if (/fatal|error/i.test(result)) throw new Error(result);
  return parseInt(result.trim(), 10);
}

async function syncBranch(g, branchName) {
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
}

async function main() {
  // TODO compute this
  const longestNameLength = 18;
  for (const repoBatch of chunk(repos, 1)) {
    const promises = repoBatch.map(repo => gitRepo(repo, longestNameLength));
    await Promise.all(promises).catch(err => console.error(err));
  }
}

async function gitRepo(repo, longestNameLength) {
  let msg = '';
  msg += notify(`${repo}: `, { padRight: longestNameLength });
  const g = git(path.join(basePath, repo)).silent(true);
  await g.fetch();

  const originalStatus = await g.status();
  const originalBranch = originalStatus.current;

  const branches = [originalBranch];
  const mainBranchName = reposUsingMain.includes(repo) ? 'main' : 'master'
  if (originalBranch !== mainBranchName) {
    branches.unshift(mainBranchName);
  }

  for (const branch of branches) {
    msg += notify(`${branch} `, {padRight: 'master'.length + 1 });
    try {
      // Only works with branches that track branches with the same name:
      const numBehind = await behind(g, branch);
      if (numBehind > 0) {
        msg += notify(`⏩︎(${numBehind} behind) `);
        await syncBranch(g, branch, numBehind);
        msg += notify('✓ ');
      } else {
        msg += notify('✓ ');
      }
    } catch (ex) {
      msg += notify(ex, { isError: true });
      // await restore(g);
    }
  }
  // await g.checkout(originalBranch);
  msg += notify('', { newline: true });
  write(msg);
}

main();
