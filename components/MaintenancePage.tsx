import React from "react";

export default function MaintenancePage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
            <div className="max-w-md w-full text-center space-y-6 bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700">
                <div className="flex justify-center">
                    <div className="p-4 bg-orange-500/10 rounded-full">
                        <svg
                            className="w-16 h-16 text-orange-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    </div>
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-white">
                    Scheduled Maintenance
                </h1>
                <p className="text-gray-400 text-lg">
                    We are currently performing some scheduled maintenance. We'll be back online shortly. 
                </p>
                <p className="text-sm text-gray-500 pt-4">
                    Please contact support if you have any questions.
                </p>
            </div>
        </div>
    );
}
