import { Skeleton } from '@/components/ui/skeleton'

export default function SignalsLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-32 mb-6" />
      <div className="flex gap-2 mb-6">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-36" />)}
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-36 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}
