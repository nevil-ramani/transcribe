export async function GET() {
    try {
        const response = await fetch('https://www.clipto.com/api/csrf');
        if (!response.ok) {
            return new Response(JSON.stringify({ error: 'Failed to fetch data' }), { status: response.status });
        }

        const data = await response.json();
        return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('Error fetching CSRF token:', error);
        return new Response(JSON.stringify({ error: 'An error occurred' }), { status: 500 });
    }
}