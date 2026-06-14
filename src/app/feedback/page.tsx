import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Beta Feedback – MarginSync",
};

export default function FeedbackPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-2 text-gray-800">Beta Feedback</h1>
      <p className="text-gray-500 mb-8">
        Thanks for testing MarginSync! Fill out this quick form to help us improve.
      </p>
      <iframe
        src="https://docs.google.com/forms/d/1vJNJcFMkTVeIvewsNI63bp466745sFsGbRh524JtzVo/viewform?embedded=true"
        className="w-full border-0 rounded-lg"
        height={900}
        title="MarginSync Beta Feedback"
      >
        Loading…
      </iframe>
    </main>
  );
}
