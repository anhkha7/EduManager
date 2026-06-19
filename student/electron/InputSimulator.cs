using System;
using System.Runtime.InteropServices;

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

        const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        const uint MOUSEEVENTF_LEFTUP = 0x0004;
        const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
        const uint MOUSEEVENTF_RIGHTUP = 0x0010;
        const uint MOUSEEVENTF_WHEEL = 0x0800;

        const uint KEYEVENTF_KEYUP = 0x0002;

        static void Main(string[] args)
        {
            // SM_CXSCREEN = 0, SM_CYSCREEN = 1
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
