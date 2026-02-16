export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const params = await searchParams;
  const redirect = params?.redirect ?? "/";
  const hasError = params?.error === "1";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F1B434]/60 via-[#ffe8be] to-[#F1B434] p-4">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-[#d9b206]/20 bg-white/90 p-8 backdrop-blur-sm">
          <div className="space-y-6">
            {/* Header */}
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-slate-900">
                CRAF'd Transparency Portal
              </h1>
              <p className="text-slate-600">Please sign in to continue</p>
            </div>

            {/* Error Message */}
            {hasError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
                <p className="font-medium">Incorrect username or password</p>
                <p className="mt-1 text-sm">
                  Please try again or contact us for assistance.
                </p>
              </div>
            )}

            {/* Form */}
            <form method="POST" action="/auth/" className="space-y-5">
              <input type="hidden" name="redirect" value={redirect} />

              <div className="space-y-2">
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-slate-700"
                >
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="Enter username"
                  autoFocus
                  autoComplete="username"
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 transition-all placeholder:text-slate-400 focus:border-transparent focus:ring-2 focus:ring-[#e6af26] focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-700"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter password"
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 transition-all placeholder:text-slate-400 focus:border-transparent focus:ring-2 focus:ring-[#e6af26] focus:outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-[#e6af26] px-4 py-3 font-medium text-white transition-colors hover:bg-[#a78003]"
              >
                Enter
              </button>
            </form>

            {/* Footer */}
            <div className="border-t border-slate-200 pt-6">
              <p className="text-sm text-slate-500">
                For login credentials, contact{" "}
                <a
                  href="mailto:crafd@un.org?subject=Access%20Request%20%7C%20Crisis%20Data%20Funding%20Compass"
                  className="font-medium text-[#e6af26] transition-colors hover:text-[#a78003]"
                >
                  crafd@un.org
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
