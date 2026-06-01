const assert = require('assert');
const ncm = require('NeteaseCloudMusicApi');
const { callNcm } = require('../lib/ncmClient');
const { normalizeRecentTracks } = require('../lib/trackNormalizer');

const records = [
  {
    data: {
      id: 101,
      name: '年少有为',
      ar: [{ name: '李荣浩' }],
      al: { name: '耳朵', picUrl: 'https://img.example/cover.jpg' },
    },
  },
  {
    song: {
      id: 102,
      name: 'Fallback Shape',
      artists: [{ name: 'Artist B' }],
      album: { name: 'Album B', picUrl: 'https://img.example/b.jpg' },
    },
  },
];

const tracks = normalizeRecentTracks(records, 6);
assert.strictEqual(tracks.length, 2, 'should normalize available records');
assert.deepStrictEqual(tracks[0], {
  nid: 101,
  title: '年少有为',
  artist: '李荣浩',
  album: '耳朵',
  cover: 'https://img.example/cover.jpg',
});
assert.strictEqual(tracks[1].artist, 'Artist B');

const mixedRecords = [
  null,
  { data: null },
  { id: 103, name: 'Direct Shape', ar: [], al: { name: 'Album C', blurPicUrl: 'https://img.example/c.jpg' } },
  { data: { name: 'Missing Id', ar: [{ name: 'Artist D' }] } },
  { song: { id: 104, name: 'Second Direct', artists: [{ name: 'Artist E' }], album: { name: 'Album E' } } },
];

const filteredTracks = normalizeRecentTracks(mixedRecords, 1);
assert.strictEqual(filteredTracks.length, 1, 'should filter invalid records and honor limit');
assert.deepStrictEqual(filteredTracks[0], {
  nid: 103,
  title: 'Direct Shape',
  artist: 'Unknown Artist',
  album: 'Album C',
  cover: 'https://img.example/c.jpg',
});

const recentEnvelopeTracks = normalizeRecentTracks({
  data: {
    list: [
      {
        data: {
          id: 201,
          name: 'Recent Envelope',
          ar: [{ name: 'Artist Recent' }],
          al: { name: 'Album Recent', picUrl: 'https://img.example/recent.jpg' },
        },
      },
    ],
  },
});
assert.strictEqual(recentEnvelopeTracks.length, 1, 'should read record_recent_song data.list envelopes');
assert.deepStrictEqual(recentEnvelopeTracks[0], {
  nid: 201,
  title: 'Recent Envelope',
  artist: 'Artist Recent',
  album: 'Album Recent',
  cover: 'https://img.example/recent.jpg',
});

const userRecordTracks = normalizeRecentTracks({
  data: [],
  weekData: [
    {
      song: {
        id: 301,
        name: 'Weekly Record',
        artists: [{ name: 'Artist Weekly' }],
        album: { name: 'Album Weekly', blurPicUrl: 'https://img.example/weekly.jpg' },
      },
    },
  ],
  allData: [
    {
      song: {
        id: 302,
        name: 'All Record',
        artists: [{ name: 'Artist All' }],
        album: { name: 'Album All' },
      },
    },
  ],
});
assert.strictEqual(userRecordTracks.length, 1, 'should read first non-empty user_record array');
assert.deepStrictEqual(userRecordTracks[0], {
  nid: 301,
  title: 'Weekly Record',
  artist: 'Artist Weekly',
  album: 'Album Weekly',
  cover: 'https://img.example/weekly.jpg',
});

ncm.__codex_test_call = async (params) => ({ body: params });

(async () => {
  const response = await callNcm('__codex_test_call', { cookie: 'params-cookie', value: 1 }, 'session-cookie');
  assert.deepStrictEqual(
    response,
    { cookie: 'session-cookie', value: 1 },
    'callNcm should inject provided session cookie and return response body'
  );

  let missingError = null;
  try {
    await callNcm('__codex_missing_call');
  } catch (error) {
    missingError = error;
  }

  assert(missingError, 'missing NCM functions should throw');
  assert.strictEqual(missingError.status, 404, 'missing NCM functions should use 404 status');

  delete ncm.__codex_test_call;
  console.log('track normalizer checks passed');
})();
