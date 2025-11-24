# Accessing the V2 Scheduler View

## Correct URL Format

To access the new v2 scheduler interface, use the following URL format:

```
http://100.111.63.95:20000/client?v2=1
```

**Important:** 
- Use `?` (question mark) for query parameters, not `/` (slash)
- Correct: `/client?v2=1` ✅
- Incorrect: `/client/v2=1` ❌

## Troubleshooting

If you see a blank page:

1. **Check the browser console** (Press F12 → Console tab) for any JavaScript errors
2. **Verify the URL** - Make sure you're using `?v2=1` not `/v2=1`
3. **Clear browser cache** - Hard refresh with Ctrl+Shift+R (or Cmd+Shift+R on Mac)
4. **Check network tab** - Ensure all JavaScript files are loading correctly

## Expected Behavior

When accessing `/client?v2=1`, you should see:
- A header with "Lab Scheduler" title
- A date range selector
- Three panels: Filters (left), Timeline (center), Booking Cart (right)
- Dark mode toggle button in the header

## Debugging

The component now includes console logging. Open the browser console to see:
- `ClientRoute - v2 parameter: 1` (confirms the parameter is read correctly)
- `ClientV2 component rendering...` (confirms the component is mounting)

If you see an error boundary message, it means there's a JavaScript error preventing the component from rendering. Check the error details in the console.



