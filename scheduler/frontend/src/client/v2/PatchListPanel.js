import React, { useState, useMemo, startTransition } from 'react';
import Fuse from 'fuse.js';
import { useDevices } from '../../services/deviceService';
import useSchedulerStore from '../../store/schedulerStore';
import { useToastContext } from '../../contexts/ToastContext';
import useBookingState from '../../store/useBookingState';

/**
 * Parse patch list text to extract polatis_name values
 * Supports both Python tuple syntax and JSON array syntax
 */
function parsePatchText(text) {
  if (!text || !text.trim()) {
    return [];
  }

  const trimmed = text.trim();

  // Try JSON parsing first
  try {
    // Replace single quotes with double quotes for JSON compatibility
    // But be careful not to replace quotes inside strings
    let normalized = trimmed;
    
    // Try direct JSON parse first
    try {
      const json = JSON.parse(normalized);
      if (Array.isArray(json)) {
        // Flatten array of arrays/tuples
        return json.flatMap(x => {
          if (Array.isArray(x)) {
            return x.filter(item => typeof item === 'string' && item.trim().length > 0);
          }
          return typeof x === 'string' && x.trim().length > 0 ? [x] : [];
        });
      }
    } catch (e) {
      // Try with single quote replacement
      normalized = trimmed.replace(/'/g, '"');
      const json = JSON.parse(normalized);
      if (Array.isArray(json)) {
        return json.flatMap(x => {
          if (Array.isArray(x)) {
            return x.filter(item => typeof item === 'string' && item.trim().length > 0);
          }
          return typeof x === 'string' && x.trim().length > 0 ? [x] : [];
        });
      }
    }
  } catch (e) {
    // Fall through to regex parser
  }

  // Fallback: regex parser for tuple-style syntax
  // Matches: ('name1', 'name2') or ["name1", "name2"] or ('name1',) or "name1"
  const regex = /['"]([^'"]+)['"]/g;
  const matches = [];
  let match;
  while ((match = regex.exec(trimmed)) !== null) {
    const name = match[1].trim();
    if (name.length > 0) {
      matches.push(name);
    }
  }
  
  return matches;
}

// Helper function to get dates in range
const getDatesInRange = (start, end) => {
  if (!start || !end) {
    return [];
  }

  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return [];
  }

  const dates = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

export default function PatchListPanel() {
  const { data: devices = [] } = useDevices();
  const { filters, setDeviceIds, ui } = useSchedulerStore();
  const { success, error: showError, warning: showWarning } = useToastContext();
  const importDeviceSelections = useBookingState((state) => state.importDeviceSelections);
  const [patchText, setPatchText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Create a map of polatis_name to device IDs
  // Since devices come from the API with all their properties including polatis_name,
  // we map polatis_name directly to device IDs
  const polatisNameMap = useMemo(() => {
    const map = new Map();
    devices.forEach(device => {
      if (device.polatis_name) {
        if (!map.has(device.polatis_name)) {
          map.set(device.polatis_name, []);
        }
        // Store the device ID
        map.get(device.polatis_name).push(device.id);
      }
    });
    return map;
  }, [devices]);

  const polatisNames = useMemo(() => Array.from(polatisNameMap.keys()), [polatisNameMap]);

  const polatisNameSearch = useMemo(() => {
    if (polatisNames.length === 0) {
      return null;
    }
    return new Fuse(polatisNames, {
      includeScore: true,
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: 2,
      distance: 150,
    });
  }, [polatisNames]);

  const polatisNameCanonicalLookup = useMemo(() => {
    const lookup = new Map();
    polatisNameMap.forEach((_, key) => {
      if (typeof key === 'string') {
        lookup.set(key.toLowerCase(), key);
      }
    });
    return lookup;
  }, [polatisNameMap]);

  const handlePreviewAndSelect = () => {
    setIsProcessing(true);
    
    try {
      // Parse patch text to get polatis names
      const parsedNames = parsePatchText(patchText);
      const uniqueNames = Array.from(
        new Set(
          parsedNames
            .map((name) => (typeof name === 'string' ? name.trim() : ''))
            .filter((name) => name.length > 0)
        )
      );
      
      if (uniqueNames.length === 0) {
        showError('No valid polatis names found in the patch list');
        setIsProcessing(false);
        return;
      }

      // Map polatis names to device IDs (with fuzzy matching support)
      const matchedDeviceIds = new Set();
      const unmatchedNames = [];
      const fuzzyCorrections = [];

      uniqueNames.forEach((inputName) => {
        const canonicalDirect = polatisNameMap.has(inputName)
          ? inputName
          : polatisNameCanonicalLookup.get(inputName.toLowerCase());

        if (canonicalDirect) {
          const ids = polatisNameMap.get(canonicalDirect) || [];
          ids.forEach((id) => {
            matchedDeviceIds.add(id);
          });
          if (canonicalDirect !== inputName) {
            fuzzyCorrections.push({ original: inputName, corrected: canonicalDirect });
          }
          return;
        }

        if (polatisNameSearch) {
          const fuzzyResults = polatisNameSearch.search(inputName);
          if (fuzzyResults.length > 0) {
            const { item: matchedName, score } = fuzzyResults[0];
            if (matchedName && (typeof score !== 'number' || score <= 0.45)) {
              const candidateIds = polatisNameMap.get(matchedName) || [];
              if (candidateIds.length > 0) {
                candidateIds.forEach((id) => matchedDeviceIds.add(id));
                fuzzyCorrections.push({ original: inputName, corrected: matchedName });
                return;
              }
            }
          }
        }

        unmatchedNames.push(inputName);
      });

      // Set device filter to show only matched devices
      if (matchedDeviceIds.size > 0) {
        // Get the date range from UI state (preferred) or fallback to selectedRange
        const dateRange = ui?.dateRange || {};
        const { start, end } = dateRange;
        const dates = getDatesInRange(start, end);

        // Update device selections - importDeviceSelections now batches all updates
        // into a single state update, ensuring conflict detection runs correctly
        // This ensures conflicts are properly detected since we're using the UI date range
        if (dates.length > 0) {
          importDeviceSelections(Array.from(matchedDeviceIds), dates);
        } else {
          // If no date range is set, still import devices (they'll be selected without dates)
          // This maintains backward compatibility
          importDeviceSelections(Array.from(matchedDeviceIds), []);
        }

        // Update filter in a transition to reduce visual re-renders
        // This is safe to defer since it doesn't affect conflict detection
        startTransition(() => {
          setDeviceIds(Array.from(matchedDeviceIds));
        });

        success(`Selected ${matchedDeviceIds.size} device(s) from patch list`);

        if (fuzzyCorrections.length > 0) {
          setTimeout(() => {
            const summary = fuzzyCorrections
              .slice(0, 5)
              .map(({ original, corrected }) => `${original} → ${corrected}`)
              .join(', ');
            showWarning(`Auto-corrected names: ${summary}${fuzzyCorrections.length > 5 ? ` (and ${fuzzyCorrections.length - 5} more)` : ''}`);
          }, 300);
        }

        // Show warning for unmatched names
        if (unmatchedNames.length > 0) {
          setTimeout(() => {
            showWarning(`⚠️ Unknown polatis names skipped: ${unmatchedNames.slice(0, 5).join(', ')}${unmatchedNames.length > 5 ? ` (and ${unmatchedNames.length - 5} more)` : ''}`);
          }, fuzzyCorrections.length > 0 ? 650 : 500);
        }
      } else {
        if (unmatchedNames.length > 0) {
          showError(`No devices found. Unknown polatis names: ${unmatchedNames.slice(0, 5).join(', ')}${unmatchedNames.length > 5 ? ` (and ${unmatchedNames.length - 5} more)` : ''}`);
        } else {
          showError('No devices found matching the patch list');
        }
      }
    } catch (err) {
      showError(`Error parsing patch list: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = () => {
    setPatchText('');
    setDeviceIds([]);
    success('Patch list filter cleared');
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Paste Patch List
        </label>
        <textarea
          value={patchText}
          onChange={(e) => setPatchText(e.target.value)}
          placeholder={`Example format:\n[('tf_1', 'roadm_10_p2'), ('cassini_2', 'roadm_10_p9')]\n\nor\n\n[["tf_1","roadm_10_p2"],["cassini_2","roadm_10_p9"]]`}
          className="w-full h-40 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 font-mono"
        />
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
        <p className="font-medium mb-1">Example formats:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Python tuples: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">[('tf_1', 'roadm_10_p2')]</code></li>
          <li>JSON arrays: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">[["tf_1","roadm_10_p2"]]</code></li>
        </ul>
        <p className="mt-2">The parser will extract all unique polatis names and filter the scheduler to show only matching devices.</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handlePreviewAndSelect}
          disabled={isProcessing || !patchText.trim()}
          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isProcessing ? 'Processing...' : 'Preview & Select'}
        </button>
        {filters.deviceIds.length > 0 && (
          <button
            onClick={handleClear}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {filters.deviceIds.length > 0 && (
        <div className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2 rounded-md">
          ✓ Filtering {filters.deviceIds.length} device(s) from patch list
        </div>
      )}
    </div>
  );
}

