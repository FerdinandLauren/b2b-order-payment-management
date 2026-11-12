function formatDocument(prefix, sequence, year = null) {
  const padded = String(sequence).padStart(4, '0');
  return year ? `${prefix}-${year}-${padded}` : `${prefix}-${padded}`;
}

module.exports = { formatDocument };
