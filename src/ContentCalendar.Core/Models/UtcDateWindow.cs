namespace ContentCalendar.Core.Models;

/// <summary>
/// A half-open UTC interval <c>[StartUtc, EndUtcExclusive)</c> passed to repositories.
/// </summary>
public sealed record UtcDateWindow
{
    public UtcDateWindow(DateTime startUtc, DateTime endUtcExclusive)
    {
        if (startUtc.Kind != DateTimeKind.Utc || endUtcExclusive.Kind != DateTimeKind.Utc)
        {
            throw new ArgumentException("Both window bounds must be UTC.");
        }

        if (endUtcExclusive <= startUtc)
        {
            throw new ArgumentException("The window end must be after its start.", nameof(endUtcExclusive));
        }

        StartUtc = startUtc;
        EndUtcExclusive = endUtcExclusive;
    }

    public DateTime StartUtc { get; }

    public DateTime EndUtcExclusive { get; }

    public bool Contains(DateTime utc) => utc >= StartUtc && utc < EndUtcExclusive;
}
