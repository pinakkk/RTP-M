import psutil
import json
import sys
import time

# Global cache to persist process objects between runs
process_cache = {}

def get_process_data():
    global process_cache
    app_names = [
        "chrome.exe",
        "node.exe",
        "code.exe",
        "python.exe",
        "postman.exe",
        "slack.exe",
        "adobe premiere pro.exe",
        "afterfx.exe",
    ]

    # Update process cache with current processes
    current_processes = {}
    for proc in psutil.process_iter(['pid', 'name', 'memory_info']):
        try:
            pid = proc.info['pid']
            if pid not in process_cache:
                # Initialize with a first call to cpu_percent to start tracking
                proc.cpu_percent()  # Warm-up call
            current_processes[pid] = {
                "proc": proc,
                "name": proc.info['name'],
                "memory_info": proc.info['memory_info']
            }
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    # Wait a bit to allow CPU usage to accumulate
    time.sleep(0.5)

    # Collect data with CPU usage
    all_processes = []
    for pid, data in current_processes.items():
        try:
            cpu_percent = data['proc'].cpu_percent()  # Get CPU usage since last call
            memory_mb = data['memory_info'].rss / 1024 / 1024  # Resident Set Size in MB
            all_processes.append({
                "name": data['name'],
                "pid": pid,
                "cpu": cpu_percent,
                "memory": memory_mb
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    # Update cache for next run
    process_cache = {pid: data['proc'] for pid, data in current_processes.items()}

    # Group apps
    app_map = {}
    for proc in all_processes:
        if proc['name'].lower() in app_names:
            if proc['name'] in app_map:
                app_map[proc['name']]['cpu'] += proc['cpu']
                app_map[proc['name']]['memory'] += proc['memory']
                app_map[proc['name']]['instances'] += 1
            else:
                app_map[proc['name']] = {
                    "name": proc['name'],
                    "cpu": proc['cpu'],
                    "memory": proc['memory'],
                    "instances": 1
                }

    apps = [
        {
            "name": data['name'],
            "cpu": round(data['cpu'], 2),
            "memory": round(data['memory'], 2),
            "instances": data['instances']
        }
        for data in app_map.values()
    ]

    total_memory_used = sum(app['memory'] for app in apps)
    total_cpu_used = sum(app['cpu'] for app in apps)

    # System stats
    system_stats = {
        "totalCpuUsage": round(psutil.cpu_percent(interval=0.5), 2),
        "totalMemory": round(psutil.virtual_memory().total / 1024 / 1024 / 1024, 2),
        "usedMemory": round(psutil.virtual_memory().used / 1024 / 1024 / 1024, 2)
    }

    all_processes = [
        {
            "name": proc['name'],
            "pid": proc['pid'],
            "cpu": round(proc['cpu'], 2),
            "memory": round(proc['memory'], 2)
        }
        for proc in all_processes
    ]

    return {
        "apps": apps,
        "totalMemoryUsed": round(total_memory_used, 2),
        "totalCpuUsed": round(total_cpu_used, 2),
        "allProcesses": all_processes,
        "systemStats": system_stats
    }

if __name__ == "__main__":
    data = get_process_data()
    print(json.dumps(data))  # Output JSON to stdout
    sys.stdout.flush()