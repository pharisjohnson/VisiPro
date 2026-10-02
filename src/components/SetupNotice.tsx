import React from 'react';

export const SetupNotice: React.FC<{ missing: string[] }> = ({ missing }) => (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
        <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-lg">
            <h1 className="text-xl font-bold text-gray-800 mb-2">Setup needed</h1>
            <p className="text-gray-600 mb-4">These environment variables are missing. Add them to <code className="bg-gray-100 px-1 rounded">.env.local</code> and restart the dev server:</p>
            <ul className="list-disc list-inside mb-4 font-mono text-sm text-red-700">
                {missing.map(m => <li key={m}>{m}</li>)}
            </ul>
            <p className="text-sm text-gray-500">See the README for how to get them from Convex and Clerk.</p>
        </div>
    </div>
);
