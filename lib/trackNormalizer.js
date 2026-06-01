function pickSong(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  return record.data || record.song || record;
}

function pickArtists(song) {
  const artists = song.ar || song.artists || [];
  return artists
    .map((artist) => artist && artist.name)
    .filter(Boolean)
    .join(' / ') || 'Unknown Artist';
}

function normalizeTrack(record) {
  const song = pickSong(record);
  if (!song || !song.id || !song.name) {
    return null;
  }

  const album = song.al || song.album || {};
  return {
    nid: song.id,
    title: song.name,
    artist: pickArtists(song),
    album: album.name || '',
    cover: album.picUrl || album.blurPicUrl || '',
  };
}

function normalizeRecentTracks(records, limit = 6) {
  const selectedRecords = pickRecordArray(records);
  return selectedRecords
    .map(normalizeTrack)
    .filter(Boolean)
    .slice(0, limit);
}

function pickRecordArray(input) {
  const candidates = [
    input,
    input && input.data && input.data.list,
    input && input.data,
    input && input.weekData,
    input && input.allData,
  ];

  return candidates.find((candidate) => Array.isArray(candidate) && candidate.length > 0) || [];
}

module.exports = { normalizeRecentTracks };
