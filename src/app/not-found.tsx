import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-50 text-navy-600">
        <FileQuestion className="h-7 w-7" />
      </div>
      <h1 className="mt-4 text-xl font-semibold text-ink">ಪುಟ ಕಂಡುಬಂದಿಲ್ಲ · Page not found</h1>
      <p className="mt-1.5 text-sm text-ink-3">
        ನೀವು ಹುಡುಕುತ್ತಿರುವ ಪುಟ ಅಸ್ತಿತ್ವದಲ್ಲಿಲ್ಲ. The page you are looking for does not exist.
      </p>
      <Link
        href="/dashboard"
        className="btn-base mt-5 bg-navy-800 px-4 py-2 text-sm text-white hover:bg-navy-700"
      >
        ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ · Dashboard
      </Link>
    </div>
  );
}
