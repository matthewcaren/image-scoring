import json
import os
import sys
from itertools import product

# Define possible values for each attribute
IRREGULARITY_VALUES = [0, 0.5, 1]
ASPECT_VALUES = [0.2, 0.5, 1]
COLOR_VALUES = ["red", "green", "blue"]

ANIM_LENGTH = 3000

# Number of suites to generate
N_SUITES = 27
MIN_SUITES_FOR_COVERAGE = 27  # Ensures all default combinations are covered

def generate_all_transitions(attribute_values):
    """Generate all possible transitions for a given attribute."""
    transitions = []
    for start, end in product(attribute_values, repeat=2):
        if start != end:  # Only include actual changes
            transitions.append((start, end))
    return transitions

def create_animation(start_state, end_state):
    """Create an animation object."""
    return {
        "anim_length": ANIM_LENGTH,
        "start_state": start_state.copy(),
        "end_state": end_state.copy()
    }

def generate_suite(default_irregularity, default_aspect, default_color, 
                   irregularity_transitions, aspect_transitions, color_transitions):
    """Generate a suite of 9 animations (3 per attribute type)."""
    animations = []
    
    # Generate 3 irregularity animations
    for start_irr, end_irr in irregularity_transitions:
        start_state = {
            "irregularity": start_irr,
            "aspect_ratio": default_aspect,
            "color": default_color
        }
        end_state = {
            "irregularity": end_irr,
            "aspect_ratio": default_aspect,
            "color": default_color
        }
        animations.append(create_animation(start_state, end_state))
    
    # Generate 3 aspect ratio animations
    for start_asp, end_asp in aspect_transitions:
        start_state = {
            "irregularity": default_irregularity,
            "aspect_ratio": start_asp,
            "color": default_color
        }
        end_state = {
            "irregularity": default_irregularity,
            "aspect_ratio": end_asp,
            "color": default_color
        }
        animations.append(create_animation(start_state, end_state))
    
    # Generate 3 color animations
    for start_col, end_col in color_transitions:
        start_state = {
            "irregularity": default_irregularity,
            "aspect_ratio": default_aspect,
            "color": start_col
        }
        end_state = {
            "irregularity": default_irregularity,
            "aspect_ratio": default_aspect,
            "color": end_col
        }
        animations.append(create_animation(start_state, end_state))
    
    return animations

def get_suite_signature(config):
    """Generate a unique signature for a suite configuration."""
    defaults = tuple(config['defaults'])
    irr_trans = tuple(sorted(config['irregularity_transitions']))
    asp_trans = tuple(sorted(config['aspect_transitions']))
    col_trans = tuple(sorted(config['color_transitions']))
    return (defaults, irr_trans, asp_trans, col_trans)

def generate_suite_configs(n_suites, all_irregularity_transitions, all_aspect_transitions, all_color_transitions):
    """Generate N unique suite configurations ensuring all default combinations are covered."""
    default_combinations = list(product(IRREGULARITY_VALUES, ASPECT_VALUES, COLOR_VALUES))
    
    if n_suites < len(default_combinations):
        raise ValueError(
            f"Error: {n_suites} suites is insufficient to cover all default combinations. "
            f"Need at least {len(default_combinations)} suites."
        )
    
    suite_configs = []
    seen_signatures = set()
    used_defaults = set()
    
    # Distribute transitions across suites
    irr_idx = 0
    asp_idx = 0
    col_idx = 0
    
    # First, ensure all 27 default combinations are used exactly once
    for default_combo in default_combinations:
        # Get 3 transitions for each attribute (cycle through all available transitions)
        irr_trans = []
        for i in range(3):
            irr_trans.append(all_irregularity_transitions[(irr_idx + i) % len(all_irregularity_transitions)])
        
        asp_trans = []
        for i in range(3):
            asp_trans.append(all_aspect_transitions[(asp_idx + i) % len(all_aspect_transitions)])
        
        col_trans = []
        for i in range(3):
            col_trans.append(all_color_transitions[(col_idx + i) % len(all_color_transitions)])
        
        # Create config
        config = {
            'defaults': default_combo,
            'irregularity_transitions': irr_trans,
            'aspect_transitions': asp_trans,
            'color_transitions': col_trans
        }
        
        # Check if this suite is unique
        signature = get_suite_signature(config)
        if signature not in seen_signatures:
            suite_configs.append(config)
            seen_signatures.add(signature)
            used_defaults.add(default_combo)
            
            # Move to next set of transitions
            irr_idx += 3
            asp_idx += 3
            col_idx += 3
        else:
            # If we get a duplicate with the current transition set, shift indices
            irr_idx += 1
            asp_idx += 1
            col_idx += 1
            
            # Retry with new transitions
            irr_trans = []
            for i in range(3):
                irr_trans.append(all_irregularity_transitions[(irr_idx + i) % len(all_irregularity_transitions)])
            
            asp_trans = []
            for i in range(3):
                asp_trans.append(all_aspect_transitions[(asp_idx + i) % len(all_aspect_transitions)])
            
            col_trans = []
            for i in range(3):
                col_trans.append(all_color_transitions[(col_idx + i) % len(all_color_transitions)])
            
            config = {
                'defaults': default_combo,
                'irregularity_transitions': irr_trans,
                'aspect_transitions': asp_trans,
                'color_transitions': col_trans
            }
            
            signature = get_suite_signature(config)
            if signature not in seen_signatures:
                suite_configs.append(config)
                seen_signatures.add(signature)
                used_defaults.add(default_combo)
                
                irr_idx += 3
                asp_idx += 3
                col_idx += 3
            else:
                raise ValueError(f"Could not generate unique suite for defaults {default_combo}")
    
    # If more suites are needed beyond the 27 default combinations, generate additional ones
    attempts = 0
    max_attempts = (n_suites - len(suite_configs)) * 3
    
    while len(suite_configs) < n_suites and attempts < max_attempts:
        attempts += 1
        
        # Cycle through default combinations again
        defaults = default_combinations[len(suite_configs) % len(default_combinations)]
        
        # Get 3 transitions for each attribute
        irr_trans = []
        for i in range(3):
            irr_trans.append(all_irregularity_transitions[(irr_idx + i) % len(all_irregularity_transitions)])
        
        asp_trans = []
        for i in range(3):
            asp_trans.append(all_aspect_transitions[(asp_idx + i) % len(all_aspect_transitions)])
        
        col_trans = []
        for i in range(3):
            col_trans.append(all_color_transitions[(col_idx + i) % len(all_color_transitions)])
        
        config = {
            'defaults': defaults,
            'irregularity_transitions': irr_trans,
            'aspect_transitions': asp_trans,
            'color_transitions': col_trans
        }
        
        signature = get_suite_signature(config)
        if signature not in seen_signatures:
            suite_configs.append(config)
            seen_signatures.add(signature)
            
            irr_idx += 3
            asp_idx += 3
            col_idx += 3
        else:
            irr_idx += 1
            asp_idx += 1
            col_idx += 1
    
    if len(suite_configs) < n_suites:
        raise ValueError(f"Could not generate {n_suites} unique suites. Only generated {len(suite_configs)}.")
    
    return suite_configs

def main():
    # Use the N_SUITES constant defined at the top of the file
    n_suites = N_SUITES
    
    # Generate all possible transitions for each attribute
    all_irregularity_transitions = generate_all_transitions(IRREGULARITY_VALUES)
    all_aspect_transitions = generate_all_transitions(ASPECT_VALUES)
    all_color_transitions = generate_all_transitions(COLOR_VALUES)
    
    total_transitions = (len(all_irregularity_transitions) + 
                        len(all_aspect_transitions) + 
                        len(all_color_transitions))
    
    print(f"Total irregularity transitions: {len(all_irregularity_transitions)}")
    print(f"Total aspect transitions: {len(all_aspect_transitions)}")
    print(f"Total color transitions: {len(all_color_transitions)}")
    print(f"Total transitions: {total_transitions}")
    print(f"Requested suites: {n_suites}\n")
    
    # Validate that we have enough suites for coverage
    if n_suites < MIN_SUITES_FOR_COVERAGE:
        raise ValueError(
            f"Error: {n_suites} suites is insufficient for coverage. "
            f"Minimum required: {MIN_SUITES_FOR_COVERAGE} suites.\n"
            f"With {MIN_SUITES_FOR_COVERAGE} suites, each attribute type gets at least "
            f"2 suites to cover its {len(all_irregularity_transitions)} transitions "
            f"(3 transitions per suite)."
        )
    
    # Generate suite configurations
    try:
        suite_configs = generate_suite_configs(
            n_suites, 
            all_irregularity_transitions, 
            all_aspect_transitions, 
            all_color_transitions
        )
    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)
    
    # Organize into batches of 3
    num_batches = (len(suite_configs) + 2) // 3
    
    # Create output directory
    output_dir = "generated_stimuli"
    os.makedirs(output_dir, exist_ok=True)
    
    # Generate suites and save to files
    for batch_num in range(num_batches):
        batch_start = batch_num * 3
        batch_end = min(batch_start + 3, len(suite_configs))
        
        for suite_idx in range(batch_start, batch_end):
            config = suite_configs[suite_idx]
            suite_num_in_batch = suite_idx - batch_start + 1
            
            suite = generate_suite(
                config['defaults'][0],  # irregularity
                config['defaults'][1],  # aspect_ratio
                config['defaults'][2],  # color
                config['irregularity_transitions'],
                config['aspect_transitions'],
                config['color_transitions']
            )
            
            # Save to file
            filename = f"batch{batch_num + 1}_suite{suite_num_in_batch}.json"
            filepath = os.path.join(output_dir, filename)
            
            with open(filepath, 'w') as f:
                json.dump(suite, f, indent=4)
            
            print(f"Generated {filename} with defaults: irregularity={config['defaults'][0]}, "
                  f"aspect_ratio={config['defaults'][1]}, color={config['defaults'][2]}")
    
    print(f"\nGenerated {len(suite_configs)} unique suites in {num_batches} batches")
    print(f"Files saved to '{output_dir}/' directory")
    
    # Verify coverage
    print("\n--- Coverage Verification ---")
    
    # Verify default combinations coverage
    all_defaults = set()
    for config in suite_configs:
        all_defaults.add(config['defaults'])
    
    default_combinations_set = set(product(IRREGULARITY_VALUES, ASPECT_VALUES, COLOR_VALUES))
    print(f"Unique default combinations used: {len(all_defaults)} / {len(default_combinations_set)}")
    if all_defaults == default_combinations_set:
        print("✓ All default combinations are covered")
    else:
        missing = default_combinations_set - all_defaults
        print(f"WARNING: Missing default combinations: {missing}")
    
    # Verify transition coverage
    all_used_irr = set()
    all_used_asp = set()
    all_used_col = set()
    
    for config in suite_configs:
        all_used_irr.update(config['irregularity_transitions'])
        all_used_asp.update(config['aspect_transitions'])
        all_used_col.update(config['color_transitions'])
    
    print(f"\nUnique irregularity transitions used: {len(all_used_irr)} / {len(all_irregularity_transitions)}")
    print(f"Unique aspect transitions used: {len(all_used_asp)} / {len(all_aspect_transitions)}")
    print(f"Unique color transitions used: {len(all_used_col)} / {len(all_color_transitions)}")
    print(f"Total unique transitions: {len(all_used_irr) + len(all_used_asp) + len(all_used_col)} / {total_transitions}")
    
    # Verify uniqueness
    signatures = [get_suite_signature(config) for config in suite_configs]
    if len(signatures) != len(set(signatures)):
        print("\nWARNING: Duplicate suites detected!")
    else:
        print("\n✓ All suites are unique")

if __name__ == "__main__":
    main()
