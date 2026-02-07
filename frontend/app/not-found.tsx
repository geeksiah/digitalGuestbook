export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-50 to-surface-100">
      <div className="text-center px-4">
        <h1 className="text-9xl font-bold text-navy-900 mb-4">404</h1>
        <h2 className="text-3xl font-semibold text-navy-700 mb-4">Page Not Found</h2>
        <p className="text-surface-600 mb-8 max-w-md mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <a
          href="/"
          className="inline-block px-6 py-3 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors"
        >
          Go Home
        </a>
      </div>
    </div>
  );
}

