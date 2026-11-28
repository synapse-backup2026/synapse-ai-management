const forecast = 'https://api.open-meteo.com/v1/forecast?latitude=35.69&longitude=51.39&daily=temperature_2m_min,temperature_2m_max&forecast_days=1&timezone=Asia%2FTehran';

export async function GET() {
  try {
    const response = await fetch(forecast, {next:{revalidate:900}, signal:AbortSignal.timeout(5000)});
    if (!response.ok) throw new Error('Weather provider unavailable');
    const {daily} = await response.json() as {daily?: {time?: string[]; temperature_2m_min?: number[]; temperature_2m_max?: number[]}};
    const date = daily?.time?.[0];
    const min = daily?.temperature_2m_min?.[0];
    const max = daily?.temperature_2m_max?.[0];
    if (typeof date !== 'string' || !Number.isFinite(min) || !Number.isFinite(max)) {
      throw new Error('Missing daily forecast');
    }
    return Response.json({date,min,max});
  } catch {
    return Response.json({error:'پیش‌بینی هوا در دسترس نیست.'},{status:503});
  }
}
