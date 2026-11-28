const forecast = 'https://api.open-meteo.com/v1/forecast?latitude=35.69&longitude=51.39&daily=weather_code,temperature_2m_min,temperature_2m_max&forecast_days=1&timezone=Asia%2FTehran';

export async function GET() {
  try {
    const response = await fetch(forecast, {next:{revalidate:900}, signal:AbortSignal.timeout(5000)});
    if (!response.ok) throw new Error('Weather provider unavailable');
    const {daily} = await response.json() as {daily?: {time?: string[]; weather_code?: number[]; temperature_2m_min?: number[]; temperature_2m_max?: number[]}};
    const date = daily?.time?.[0];
    const min = daily?.temperature_2m_min?.[0];
    const max = daily?.temperature_2m_max?.[0];
    const code = daily?.weather_code?.[0];
    if (typeof date !== 'string' || !Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(code)) {
      throw new Error('Missing daily forecast');
    }
    return Response.json({date,min,max,code});
  } catch {
    return Response.json({error:'پیش‌بینی هوا در دسترس نیست.'},{status:503});
  }
}
