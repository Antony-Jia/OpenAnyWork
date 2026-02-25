import sys
from pathlib import Path
path = Path(sys.argv[1])
start = int(sys.argv[2])
end = int(sys.argv[3])
with path.open(encoding='utf-8') as f:
    for i, line in enumerate(f, 1):
        if start <= i <= end:
            print(f'{i}: {line.rstrip()}')
