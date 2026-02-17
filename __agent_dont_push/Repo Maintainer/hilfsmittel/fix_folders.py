
import os
import shutil

TARGET_NAMES = ["Mögliche Themen", "Erschienene Themen"]
ROOT_DIR = "."

def merge_move(src_dir, dst_dir):
    """
    Moves contents of src_dir to dst_dir.
    If a destination item exists, rename the source item before moving to avoid overwrite.
    """
    if not os.path.exists(dst_dir):
        # Should not happen as dst is parent, but for completeness
        return

    for item in os.listdir(src_dir):
        s = os.path.join(src_dir, item)
        d = os.path.join(dst_dir, item)
        
        if os.path.exists(d):
            # Collision
            base, ext = os.path.splitext(item)
            new_name = f"{base}_merged{ext}"
            d_new = os.path.join(dst_dir, new_name)
            
            # Ensure unique new name
            counter = 1
            while os.path.exists(d_new):
                d_new = os.path.join(dst_dir, f"{base}_merged_{counter}{ext}")
                counter += 1
            
            print(f"Collision: moving {item} to {os.path.basename(d_new)}")
            shutil.move(s, d_new)
        else:
            shutil.move(s, d)

def cleanup_folders():
    # Walk bottom-up to handle nested structures properly
    for root, dirs, files in os.walk(ROOT_DIR, topdown=False):
        for d in dirs:
            if d in TARGET_NAMES:
                full_path = os.path.join(root, d)
                parent_dir = os.path.dirname(full_path)
                
                print(f"Processing: {full_path}")
                try:
                    merge_move(full_path, parent_dir)
                    os.rmdir(full_path)
                    print(f"Removed: {full_path}")
                except OSError as e:
                    print(f"Error removing {full_path}: {e}")

if __name__ == "__main__":
    cleanup_folders()
