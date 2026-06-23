using System;
using System.Diagnostics;
using System.Text;
using System.Runtime.InteropServices;
using System.Collections.Generic;

class ProcessMonitor {
    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    public static void Main() {
        var results = new List<string>();
        
        EnumWindows((hWnd, lParam) => {
            if (IsWindowVisible(hWnd)) {
                StringBuilder sb = new StringBuilder(256);
                GetWindowText(hWnd, sb, 256);
                string title = sb.ToString().Trim();
                if (!string.IsNullOrEmpty(title)) {
                    try {
                        uint pid;
                        GetWindowThreadProcessId(hWnd, out pid);
                        Process proc = Process.GetProcessById((int)pid);
                        string procName = proc.ProcessName.ToLower();
                        results.Add(procName + "|" + title.ToLower());
                    } catch {}
                }
            }
            return true;
        }, IntPtr.Zero);

        // Print results to stdout
        foreach (var r in results) {
            Console.WriteLine(r);
        }
    }
}
