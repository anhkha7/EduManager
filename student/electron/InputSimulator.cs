using System;
using System.Runtime.InteropServices;
using System.Diagnostics;

namespace EduManager
{
    class InputSimulator
    {
        [DllImport("user32.dll")]
        static extern bool SetCursorPos(int X, int Y);

        [DllImport("user32.dll")]
        static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);

        [DllImport("user32.dll")]
        static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);

        [DllImport("user32.dll")]
        static extern int GetSystemMetrics(int nIndex);

        // ── Hook Win32 APIs ───────────────────────────────────────────
        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelHookProc lpfn, IntPtr hMod, uint dwThreadId);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool UnhookWindowsHookEx(IntPtr hhk);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr GetModuleHandle(string lpModuleName);

        [DllImport("user32.dll")]
        private static extern int GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

        [DllImport("user32.dll")]
        private static extern bool TranslateMessage(ref MSG lpMsg);

        [DllImport("user32.dll")]
        private static extern IntPtr DispatchMessage(ref MSG lpMsg);

        // ── Constants & Delegates ─────────────────────────────────────
        private const int WH_KEYBOARD_LL = 13;
        private const int WH_MOUSE_LL = 14;
        private const uint LLMHF_INJECTED = 0x01;
        private const uint LLKHF_INJECTED = 0x10;

        private delegate IntPtr LowLevelHookProc(int nCode, IntPtr wParam, IntPtr lParam);

        private static LowLevelHookProc _keyboardProc = KeyboardHookCallback;
        private static LowLevelHookProc _mouseProc = MouseHookCallback;

        private static IntPtr _keyboardHookID = IntPtr.Zero;
        private static IntPtr _mouseHookID = IntPtr.Zero;

        [StructLayout(LayoutKind.Sequential)]
        private struct POINT
        {
            public int x;
            public int y;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct MSLLHOOKSTRUCT
        {
            public POINT pt;
            public uint mouseData;
            public uint flags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct KBDLLHOOKSTRUCT
        {
            public uint vkCode;
            public uint scanCode;
            public uint flags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct MSG
        {
            public IntPtr hwnd;
            public uint message;
            public IntPtr wParam;
            public IntPtr lParam;
            public uint time;
            public POINT pt;
        }

        // ── Hook Callbacks ────────────────────────────────────────────
        private static IntPtr KeyboardHookCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0)
            {
                KBDLLHOOKSTRUCT kbd = (KBDLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(KBDLLHOOKSTRUCT));
                bool isInjected = (kbd.flags & LLKHF_INJECTED) != 0;
                
                // Nếu là phím vật lý từ học sinh -> Chặn (trả về 1)
                if (!isInjected)
                {
                    return (IntPtr)1;
                }
            }
            return CallNextHookEx(_keyboardHookID, nCode, wParam, lParam);
        }

        private static IntPtr MouseHookCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0)
            {
                MSLLHOOKSTRUCT ms = (MSLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(MSLLHOOKSTRUCT));
                bool isInjected = (ms.flags & LLMHF_INJECTED) != 0;
                
                // Nếu là chuột vật lý từ học sinh -> Chặn (trả về 1)
                if (!isInjected)
                {
                    return (IntPtr)1;
                }
            }
            return CallNextHookEx(_mouseHookID, nCode, wParam, lParam);
        }

        // ── Input Event Constants ─────────────────────────────────────
        const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        const uint MOUSEEVENTF_LEFTUP = 0x0004;
        const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
        const uint MOUSEEVENTF_RIGHTUP = 0x0010;
        const uint MOUSEEVENTF_WHEEL = 0x0800;
        const uint KEYEVENTF_KEYUP = 0x0002;

        static void Main(string[] args)
        {
            // Khởi chạy Hook Thread (Cần luồng riêng để chạy Windows Message Loop)
            System.Threading.Thread hookThread = new System.Threading.Thread(StartHooks);
            hookThread.IsBackground = true;
            hookThread.Start();

            // Chạy hàm đọc lệnh từ stdin ở Main Thread
            RunCommandReader();

            // Dọn dẹp Hook khi thoát
            StopHooks();
        }

        private static void StartHooks()
        {
            using (Process curProcess = Process.GetCurrentProcess())
            using (ProcessModule curModule = curProcess.MainModule)
            {
                IntPtr moduleHandle = GetModuleHandle(curModule.ModuleName);
                _keyboardHookID = SetWindowsHookEx(WH_KEYBOARD_LL, _keyboardProc, moduleHandle, 0);
                _mouseHookID = SetWindowsHookEx(WH_MOUSE_LL, _mouseProc, moduleHandle, 0);
            }

            // Vòng lặp tin nhắn để duy trì Hook
            MSG msg;
            while (GetMessage(out msg, IntPtr.Zero, 0, 0) > 0)
            {
                TranslateMessage(ref msg);
                DispatchMessage(ref msg);
            }
        }

        private static void StopHooks()
        {
            if (_keyboardHookID != IntPtr.Zero)
            {
                UnhookWindowsHookEx(_keyboardHookID);
                _keyboardHookID = IntPtr.Zero;
            }
            if (_mouseHookID != IntPtr.Zero)
            {
                UnhookWindowsHookEx(_mouseHookID);
                _mouseHookID = IntPtr.Zero;
            }
        }

        private static void RunCommandReader()
        {
            int screenWidth = GetSystemMetrics(0); 
            int screenHeight = GetSystemMetrics(1);

            string line;
            while ((line = Console.ReadLine()) != null)
            {
                if (string.IsNullOrEmpty(line)) continue;

                try
                {
                    string[] parts = line.Split(':');
                    if (parts.Length < 2) continue;

                    string cmd = parts[0].ToUpper();

                    if (cmd == "M" && parts.Length == 3)
                    {
                        double px = double.Parse(parts[1], System.Globalization.CultureInfo.InvariantCulture);
                        double py = double.Parse(parts[2], System.Globalization.CultureInfo.InvariantCulture);
                        
                        int x = (int)(px * screenWidth);
                        int y = (int)(py * screenHeight);
                        
                        SetCursorPos(x, y);
                    }
                    else if (cmd == "C")
                    {
                        string btn = parts[1].ToLower();
                        if (btn == "left") {
                            mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
                            mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
                        }
                        else if (btn == "right") {
                            mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0);
                            mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0);
                        }
                    }
                    else if (cmd == "MD")
                    {
                        string btn = parts[1].ToLower();
                        if (btn == "left") mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
                        else if (btn == "right") mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0);
                    }
                    else if (cmd == "MU")
                    {
                        string btn = parts[1].ToLower();
                        if (btn == "left") mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
                        else if (btn == "right") mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0);
                    }
                    else if (cmd == "W" && parts.Length == 2)
                    {
                        int delta = int.Parse(parts[1]);
                        mouse_event(MOUSEEVENTF_WHEEL, 0, 0, (uint)delta, 0);
                    }
                    else if (cmd == "K" && parts.Length == 2)
                    {
                        byte vk = byte.Parse(parts[1]);
                        keybd_event(vk, 0, 0, 0);
                        keybd_event(vk, 0, KEYEVENTF_KEYUP, 0);
                    }
                    else if (cmd == "KD" && parts.Length == 2)
                    {
                        byte vk = byte.Parse(parts[1]);
                        keybd_event(vk, 0, 0, 0);
                    }
                    else if (cmd == "KU" && parts.Length == 2)
                    {
                        byte vk = byte.Parse(parts[1]);
                        keybd_event(vk, 0, KEYEVENTF_KEYUP, 0);
                    }
                }
                catch (Exception)
                {
                    // Ignore
                }
            }
        }
    }
}
