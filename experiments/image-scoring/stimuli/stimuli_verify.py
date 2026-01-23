import json
import os
from collections import defaultdict
from itertools import combinations

# Expected values for each attribute (from stimuli_generator.py)
IRREGULARITY_VALUES = [0, 0.4, 1]
ASPECT_VALUES = [0.2, 0.5, 1]
COLOR_VALUES = ["red", "green", "blue"]

def load_stimuli_batches(stimuli_dir):
    """Load all JSON files from the generated_stimuli directory."""
    batches = {}
    
    if not os.path.exists(stimuli_dir):
        raise FileNotFoundError(f"Stimuli directory not found: {stimuli_dir}")
    
    json_files = [f for f in os.listdir(stimuli_dir) if f.endswith('.json')]
    
    for filename in sorted(json_files):
        filepath = os.path.join(stimuli_dir, filename)
        with open(filepath, 'r') as f:
            batch_name = filename.replace('.json', '')
            batches[batch_name] = json.load(f)
    
    return batches

def get_changing_attribute(start_state, end_state):
    """Identify which attribute changes between start and end states."""
    changing_attrs = []
    
    for attr in ['irregularity', 'aspect_ratio', 'color']:
        if start_state[attr] != end_state[attr]:
            changing_attrs.append(attr)
    
    return changing_attrs

def get_default_values(batch_animations):
    """Extract the default values (non-changing attributes) from a batch."""
    defaults = {'irregularity': None, 'aspect_ratio': None, 'color': None}
    
    for animation in batch_animations:
        start_state = animation['start_state']
        end_state = animation['end_state']
        changing_attrs = get_changing_attribute(start_state, end_state)
        
        # For non-changing attributes, their values are the defaults
        for attr in ['irregularity', 'aspect_ratio', 'color']:
            if attr not in changing_attrs:
                if defaults[attr] is None:
                    defaults[attr] = start_state[attr]
                elif defaults[attr] != start_state[attr]:
                    # Default should be consistent across all animations in batch
                    return None  # Invalid batch
    
    return defaults

def verify_single_attribute_change(batch_name, batch_animations):
    """Verify that only one attribute changes at a time in each animation."""
    errors = []
    
    for i, animation in enumerate(batch_animations):
        start_state = animation['start_state']
        end_state = animation['end_state']
        changing_attrs = get_changing_attribute(start_state, end_state)
        
        if len(changing_attrs) != 1:
            errors.append(f"Animation {i} changes {len(changing_attrs)} attributes: {changing_attrs}")
    
    return errors

def verify_attribute_coverage(batch_name, batch_animations):
    """Verify that each attribute has exactly 3 animations and all pairs are covered."""
    errors = []
    
    # Group animations by changing attribute
    attr_animations = defaultdict(list)
    
    for i, animation in enumerate(batch_animations):
        start_state = animation['start_state']
        end_state = animation['end_state']
        changing_attrs = get_changing_attribute(start_state, end_state)
        
        if len(changing_attrs) == 1:
            attr = changing_attrs[0]
            transition = (start_state[attr], end_state[attr])
            attr_animations[attr].append((i, transition))
    
    # Check each attribute
    expected_values = {
        'irregularity': IRREGULARITY_VALUES,
        'aspect_ratio': ASPECT_VALUES,
        'color': COLOR_VALUES
    }
    
    for attr, expected_vals in expected_values.items():
        animations = attr_animations[attr]
        
        # Should have exactly 3 animations for this attribute
        if len(animations) != 3:
            errors.append(f"Expected 3 {attr} animations, got {len(animations)}")
            continue
        
        # Extract all transitions
        transitions = [transition for _, transition in animations]
        transition_set = set(transitions)
        
        # Generate all possible pairs for this attribute
        expected_pairs = set()
        for val1, val2 in combinations(expected_vals, 2):
            expected_pairs.add((val1, val2))
            expected_pairs.add((val2, val1))  # Both directions
        
        # Check if we have exactly 3 unique transitions (all pairs, one direction each)
        if len(transition_set) != 3:
            errors.append(f"{attr}: Expected 3 unique transitions, got {len(transition_set)}: {transition_set}")
        
        # Check if all transitions are valid (use expected values)
        for transition in transition_set:
            start_val, end_val = transition
            if start_val not in expected_vals or end_val not in expected_vals:
                errors.append(f"{attr}: Invalid transition {transition}, expected values: {expected_vals}")
            elif start_val == end_val:
                errors.append(f"{attr}: No-change transition {transition}")
        
        # Check if we cover all possible pairs (in one direction or the other)
        covered_pairs = set()
        for start_val, end_val in transition_set:
            # Add both orderings to covered pairs
            covered_pairs.add(tuple(sorted([start_val, end_val])))
        
        expected_unordered_pairs = set()
        for val1, val2 in combinations(expected_vals, 2):
            expected_unordered_pairs.add(tuple(sorted([val1, val2])))
        
        if covered_pairs != expected_unordered_pairs:
            missing = expected_unordered_pairs - covered_pairs
            extra = covered_pairs - expected_unordered_pairs
            if missing:
                errors.append(f"{attr}: Missing pairs: {missing}")
            if extra:
                errors.append(f"{attr}: Extra pairs: {extra}")
    
    return errors

def verify_unique_defaults(batches):
    """Verify that default combinations are unique across all batches."""
    errors = []
    default_combinations = []
    
    for batch_name, batch_animations in batches.items():
        defaults = get_default_values(batch_animations)
        if defaults is None:
            errors.append(f"Batch {batch_name}: Inconsistent default values within batch")
            continue
        
        default_tuple = (defaults['irregularity'], defaults['aspect_ratio'], defaults['color'])
        
        if default_tuple in default_combinations:
            errors.append(f"Batch {batch_name}: Duplicate default combination {default_tuple}")
        else:
            default_combinations.append(default_tuple)
    
    return errors, default_combinations

def main():
    print("Verifying stimuli batches...")
    
    stimuli_dir = "generated_stimuli"
    
    try:
        batches = load_stimuli_batches(stimuli_dir)
        print(f"Loaded {len(batches)} batches: {list(batches.keys())}")
        
        all_errors = []
        
        # Verify each batch individually
        for batch_name, batch_animations in batches.items():
            print(f"\nVerifying batch {batch_name}...")
            
            # Check number of animations
            if len(batch_animations) != 9:
                all_errors.append(f"Batch {batch_name}: Expected 9 animations, got {len(batch_animations)}")
                continue
            
            # Check single attribute change per animation
            single_attr_errors = verify_single_attribute_change(batch_name, batch_animations)
            if single_attr_errors:
                for error in single_attr_errors:
                    all_errors.append(f"Batch {batch_name}: {error}")
            
            # Check attribute coverage and pairs
            coverage_errors = verify_attribute_coverage(batch_name, batch_animations)
            if coverage_errors:
                for error in coverage_errors:
                    all_errors.append(f"Batch {batch_name}: {error}")
            
            if not single_attr_errors and not coverage_errors:
                print(f"  ✓ Batch {batch_name} passed individual checks")
        
        # Verify unique defaults across batches
        print("\nVerifying unique default combinations across batches...")
        default_errors, default_combinations = verify_unique_defaults(batches)
        all_errors.extend(default_errors)
        
        if not default_errors:
            print(f"  ✓ All {len(default_combinations)} batches have unique default combinations")
            print("  Default combinations:")
            for i, (batch_name, defaults) in enumerate(zip(batches.keys(), default_combinations)):
                irr, asp, col = defaults
                print(f"    {batch_name}: irregularity={irr}, aspect_ratio={asp}, color='{col}'")
        
        # Summary
        print(f"\n{'='*50}")
        if all_errors:
            print(f"VERIFICATION FAILED: {len(all_errors)} errors found")
            for error in all_errors:
                print(f"  ❌ {error}")
        else:
            print("✅ VERIFICATION PASSED: all checks successful")
            print(f"  - {len(batches)} batches verified")
            print(f"  - Each batch contains 9 animations (3 per attribute)")
            print(f"  - Only one attribute changes per animation")
            print(f"  - All attribute pairs covered in each batch")
            print(f"  - All batches have unique default combinations")
    
    except Exception as e:
        print(f"Error: {e}")
        return 1
    
    return 0 if not all_errors else 1

if __name__ == "__main__":
    exit(main())
