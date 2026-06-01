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

function normalizePlaylist(playlist) {
  if (!playlist || typeof playlist !== 'object' || !playlist.id || !playlist.name) {
    return null;
  }

  return {
    id: playlist.id,
    name: playlist.name,
    cover: playlist.coverImgUrl || playlist.cover || '',
    trackCount: Number(playlist.trackCount) || 0,
    creator: playlist.creator && playlist.creator.nickname ? playlist.creator.nickname : '',
  };
}

function normalizePlaylists(input, limit = 50) {
  const candidates = [
    input && input.playlist,
    input && input.data && input.data.playlist,
    input && input.data,
    input,
  ];
  const playlists = candidates.find((candidate) => Array.isArray(candidate) && candidate.length > 0) || [];

  return playlists
    .map(normalizePlaylist)
    .filter(Boolean)
    .slice(0, limit);
}

function pickRecordArray(input) {
  const candidates = [
    input,
    input && input.songs,
    input && input.data && input.data.songs,
    input && input.data && input.data.list,
    input && input.data,
    input && input.playlist && input.playlist.tracks,
    input && input.weekData,
    input && input.allData,
  ];

  return candidates.find((candidate) => Array.isArray(candidate) && candidate.length > 0) || [];
}

module.exports = { normalizePlaylists, normalizeRecentTracks };
