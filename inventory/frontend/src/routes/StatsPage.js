import React from 'react';
import { PageHeader, Card } from '@tcdona/ui';

export default function StatsPage() {
  return (
    <div className="p-6">
      <PageHeader
        title="Inventory Overview"
        subtitle="Statistics and metrics for inventory management"
      />
      <div className="mt-6">
        <Card>
          <div className="p-4">
            <p className="text-gray-600 dark:text-gray-400">
              Stats dashboard goes here. This will show:
              <ul className="list-disc list-inside mt-2">
                <li>Total device count</li>
                <li>Devices by status</li>
                <li>Devices by type</li>
                <li>Devices by site</li>
              </ul>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

