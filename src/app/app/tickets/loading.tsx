import { Skeleton } from "@/components/ui/skeleton";

export default function TicketsLoading() {
  return (
    <div className="flex h-full w-full bg-background overflow-hidden">
      {/* Ticket List Skeleton */}
      <div className="flex w-80 md:w-96 flex-col border-r shrink-0 h-full bg-background">
        <div className="flex items-center justify-between p-4 pb-2">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
        <div className="px-4 pb-3">
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
        <div className="px-4 border-b pb-3 flex gap-4">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>
        <div className="flex-1 overflow-y-auto pt-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="p-4 border-b space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <div className="flex justify-between pt-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ticket Detail Placeholder */}
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm bg-muted/10">
        <Skeleton className="size-16 rounded-full mb-4" />
        <Skeleton className="h-4 w-40 mb-2" />
        <Skeleton className="h-3 w-64" />
      </div>
    </div>
  );
}
