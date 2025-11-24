import React, { useMemo } from 'react';
import useBookingState from '../../store/useBookingState';
import useSchedulerStore from '../../store/schedulerStore';

export default function HeatmapView({ devices, selectedDate, bookings = [] }) {
  const toggleDay = useBookingState((state) => state.toggleDay);
  const getDayKey = useBookingState((state) => state.getDayKey);
  const { ui } = useSchedulerStore();

  // Generate weeks in the date range
  const weeks = useMemo(() => {
    if (!ui.dateRange.start || !ui.dateRange.end) {
      // Default to current week
      const startDate = selectedDate ? new Date(selectedDate) : new Date();
      const dayOfWeek = startDate.getDay();
      const diff = startDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(startDate);
      monday.setDate(diff);
      monday.setHours(0, 0, 0, 0);
      
      return [{
        start: monday.toISOString().split('T')[0],
        days: Array.from({ length: 7 }, (_, i) => {
          const day = new Date(monday);
          day.setDate(monday.getDate() + i);
          return day.toISOString().split('T')[0];
        }),
      }];
    }

    const start = new Date(ui.dateRange.start);
    const end = new Date(ui.dateRange.end);
    const weeks = [];
    let current = new Date(start);
    
    // Find Monday of the week containing start date
    const dayOfWeek = current.getDay();
    const diff = current.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    current.setDate(diff);
    current.setHours(0, 0, 0, 0);

    while (current <= end) {
      const weekDays = [];
      for (let i = 0; i < 7; i++) {
        const day = new Date(current);
        day.setDate(current.getDate() + i);
        if (day >= start && day <= end) {
          weekDays.push(day.toISOString().split('T')[0]);
        }
      }
      if (weekDays.length > 0) {
        weeks.push({
          start: current.toISOString().split('T')[0],
          days: weekDays,
        });
      }
      current.setDate(current.getDate() + 7);
    }

    return weeks;
  }, [ui.dateRange, selectedDate]);

  // Calculate availability heatmap
  // Supports collapsed device groups (devices with multiple IDs)
  const heatmap = useMemo(() => {
    const map = new Map(); // "deviceId-date" -> availability score (0-1)
    
    devices.forEach(device => {
      // Get all device IDs for this device (handles collapsed groups)
      const deviceIds = device.ids || [device.id];
      
      weeks.forEach(week => {
        week.days.forEach(date => {
          const dayKey = getDayKey(device.id, date);
          
          // Check if any device in the group is booked
          const isBooked = bookings.some(booking => {
            // Check if booking belongs to any device in this group
            if (!deviceIds.includes(booking.device_id)) return false;
            const bookingStart = new Date(booking.start_time);
            const bookingEnd = new Date(booking.end_time);
            const dayStart = new Date(`${date}T07:00:00`);
            const dayEnd = new Date(`${date}T19:00:00`);
            return bookingStart < dayEnd && bookingEnd > dayStart;
          });

          if (isBooked) {
            map.set(dayKey, 0); // Fully booked
          } else {
            map.set(dayKey, 1); // Available
          }
        });
      });
    });

    return map;
  }, [devices, weeks, bookings, getDayKey]);

  // Get color intensity based on availability
  const getColor = (score) => {
    if (score === 0) return 'bg-red-500 dark:bg-red-600'; // Booked
    if (score === 1) return 'bg-green-500 dark:bg-green-600'; // Available
    return 'bg-yellow-500 dark:bg-yellow-600'; // Partially available
  };

  return (
    <div className="h-full overflow-auto p-4">
      <div className="space-y-4">
        {weeks.map((week, weekIndex) => (
          <div key={week.start} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Week of {new Date(week.days[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-700 dark:text-gray-300 p-2 sticky left-0 bg-white dark:bg-gray-800">
                      Device
                    </th>
                    {week.days.map((date) => (
                      <th
                        key={date}
                        className="text-center text-xs font-medium text-gray-700 dark:text-gray-300 p-2 min-w-[60px]"
                      >
                        {new Date(date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => (
                    <tr key={device.id} className="border-b border-gray-200 dark:border-gray-700">
                      <td className="p-2 sticky left-0 bg-white dark:bg-gray-800 z-10">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {device.deviceName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {device.deviceType}
                        </div>
                      </td>
                      {week.days.map((date) => {
                        const dayKey = getDayKey(device.id, date);
                        const score = heatmap.get(dayKey) ?? 1;
                        const color = getColor(score);
                        
                        return (
                          <td
                            key={date}
                            className={`p-2 text-center ${color} cursor-pointer hover:opacity-80 transition-opacity`}
                            onClick={() => toggleDay(device.id, date)}
                            title={`${device.deviceName} - ${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${score === 0 ? 'Booked' : 'Available'}`}
                          >
                            <div className="w-8 h-8 rounded mx-auto"></div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 dark:bg-green-600 rounded"></div>
          <span className="text-gray-600 dark:text-gray-400">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 dark:bg-red-600 rounded"></div>
          <span className="text-gray-600 dark:text-gray-400">Booked</span>
        </div>
      </div>
    </div>
  );
}

