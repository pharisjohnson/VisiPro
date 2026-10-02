import React, { useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { DAY_MS, startOfDay } from '../lib/utils';

// Calls a Convex action: the Gemini key and the org's data stay server-side.
export const AIAssistant: React.FC = () => {
    const ask = useAction(api.ai.ask);
    const [query, setQuery] = useState('');
    const [response, setResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleQuery = async () => {
        if (!query.trim() || isLoading) return;
        setIsLoading(true);
        setResponse('');
        try {
            const dayStart = startOfDay(new Date());
            setResponse(await ask({ question: query, dayStart, dayEnd: dayStart + DAY_MS }));
        } catch {
            setResponse('Sorry, the assistant could not be reached. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white p-8 rounded-lg shadow-lg border border-gray-200 h-full flex flex-col">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">AI Assistant</h2>
            <p className="text-sm text-gray-500 mb-6">Ask about today's visitors, appointments, or get help with tasks.</p>

            <div className="flex-grow bg-gray-50 rounded-md p-4 overflow-y-auto mb-4 min-h-[200px]">
                {isLoading && <p className="text-gray-500 animate-pulse">Assistant is thinking...</p>}
                {response && <p className="text-gray-800 whitespace-pre-wrap">{response}</p>}
                {!isLoading && !response && <p className="text-gray-400">Ask a question like "Summarize today's meetings" or "How many visitors are currently on-site?"</p>}
            </div>

            <div className="flex space-x-2">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
                    placeholder="Ask the AI assistant..."
                    maxLength={1000}
                    className="flex-grow mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                <button onClick={handleQuery} disabled={isLoading} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300">
                    {isLoading ? '...' : 'Ask'}
                </button>
            </div>
        </div>
    );
};
