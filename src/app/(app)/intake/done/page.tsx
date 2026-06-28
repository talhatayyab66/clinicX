import Link from "next/link";

export default function IntakeDone() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="card max-w-md text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl text-green-600">
          ✓
        </div>
        <h1 className="text-xl font-semibold">Visit recorded</h1>
        <p className="mt-2 text-sm text-gray-500">
          The visit is now open and visible to the doctor.
        </p>
        <Link href="/intake" className="btn-primary mt-4 inline-flex">
          Record another
        </Link>
      </div>
    </div>
  );
}
