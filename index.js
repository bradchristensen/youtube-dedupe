#!/usr/bin/env node

/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { last, orderBy } = require('lodash');
const parseArgs = require('minimist');

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);

const argv = parseArgs(process.argv.slice(2));

const inputDir = path.resolve(argv._[0]);

const rmDupes = argv.d || argv.delete || argv.rm || argv.remove;

const groupById = {};

async function work() {
  const items = await readdir(inputDir);
  const files = items.filter(file => !(fs.lstatSync(path.join(inputDir, file))).isDirectory());

  for (const file of files) {
    const { name, ext } = path.parse(file);
    if (['avi', 'mp4', 'mkv', 'webm', 'm4v'].includes(ext.slice(1))) {
      const nameParts = name.split('-');
      const youtubeId = last(nameParts);
      groupById[youtubeId] = groupById[youtubeId] || [];
      groupById[youtubeId].push(file);
    }
  }

  const dupes = Object.keys(groupById).filter(youtubeId => groupById[youtubeId].length > 1);
  for (const youtubeId of dupes) {
    const numDupes = groupById[youtubeId].length;
    console.log(`${youtubeId} has ${numDupes} dupes`);
  }

  console.log(`There are ${dupes.length} videos in total that have dupes.`);

  if (rmDupes) {
    console.log('You\'ve asked me to remove the duplicates! Here goes nothing...');

    await Promise.all(dupes.map(async (youtubeId) => {
      const conflicts = groupById[youtubeId];

      const filesWithModifiedDates = await Promise.all(conflicts.map(async (file) => {
        const { mtime } = await stat(path.join(inputDir, file));
        return { mtime: new Date(mtime), file };
      }));

      const filesToBeRemoved = orderBy(filesWithModifiedDates, ['mtime'], ['desc'])
        .slice(1) // Skip the most recent file
        .map(({ file }) => file);

      console.log(filesToBeRemoved);
      return Promise.all(filesToBeRemoved.map(file => unlink(path.join(inputDir, file))));
    }));
  } else {
    console.log('To remove duplicates (discard the older version(s)), add the --rm flag.');
  }
}

work();
