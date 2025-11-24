import React from 'react';

export default function SuggestedConfigurationsPanel({ recommendations, onSelectRecommendation, selectedMappingId }) {
  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  const getScoreColor = (score) => {
    if (score >= 0.8) return 'bg-green-500';
    if (score >= 0.6) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  const getRecommendationBadge = (index) => {
    if (index === 0) return '⭐ Best';
    if (index === 1) return '🥈 Runner-up';
    if (index === 2) return '🥉 Third';
    return `#${index + 1}`;
  };

  return (
    <div className="p-4 border-b border-gray-300 bg-gradient-to-br from-purple-50 to-blue-50">
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <span>💡</span>
        <span>Suggested Configurations</span>
      </h3>
      <p className="text-xs text-gray-600 mb-3">
        Ranked by performance, availability, efficiency, and reliability
      </p>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {recommendations.map((rec, index) => (
          <div
            key={rec.mapping_id}
            onClick={() => onSelectRecommendation(rec)}
            className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
              selectedMappingId === rec.mapping_id
                ? 'border-purple-500 bg-purple-50 shadow-md'
                : 'border-gray-200 hover:border-purple-300 hover:bg-white'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded">
                  {getRecommendationBadge(index)}
                </span>
                <span className="font-medium text-sm">{rec.mapping_id}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-500">Score:</div>
                <div className={`px-2 py-1 rounded text-white text-xs font-bold ${getScoreColor(rec.recommendation_score)}`}>
                  {(rec.recommendation_score * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {/* Rationale */}
            <div className="text-xs text-gray-700 mb-2 italic bg-white p-2 rounded border border-gray-200">
              {rec.rationale}
            </div>

            {/* Score Breakdown */}
            <div className="grid grid-cols-4 gap-2 mb-2">
              <div className="text-center">
                <div className="text-xs text-gray-500">Performance</div>
                <div className="text-xs font-semibold text-blue-600">
                  {(rec.performance_score * 100).toFixed(0)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">Availability</div>
                <div className="text-xs font-semibold text-green-600">
                  {(rec.availability_score * 100).toFixed(0)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">Efficiency</div>
                <div className="text-xs font-semibold text-purple-600">
                  {(rec.efficiency_score * 100).toFixed(0)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">Reliability</div>
                <div className="text-xs font-semibold text-orange-600">
                  {(rec.reliability_score * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {/* Earliest Slot */}
            {rec.earliest_available_slot && (
              <div className="text-xs text-gray-600 mt-2">
                <span className="font-medium">Earliest available:</span>{' '}
                {new Date(rec.earliest_available_slot).toLocaleString()}
              </div>
            )}

            {/* Device Summary */}
            <div className="text-xs text-gray-500 mt-2">
              {rec.mapping.node_mappings?.length || 0} devices |{' '}
              {rec.mapping.link_mappings?.length || 0} links
            </div>
          </div>
        ))}
      </div>
      {selectedMappingId && (
        <button
          onClick={() => onSelectRecommendation(null)}
          className="mt-3 w-full text-xs text-gray-600 hover:text-gray-800 underline"
        >
          Clear Selection
        </button>
      )}
    </div>
  );
}



