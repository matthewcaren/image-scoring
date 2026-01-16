import json
import os
import random
import string
from itertools import product

# Define possible values for each attribute (all 3 used for animations)
IRREGULARITY_VALUES = [0, 0.4, 1]
ASPECT_VALUES = [0.2, 0.5, 1]
COLOR_VALUES = ["red", "green", "blue"]

# Default values for non-animated attributes (2 out of 3 for each)
IRREGULARITY_DEFAULTS = [0, 0.4]
ASPECT_DEFAULTS = [0.2, 0.5]
COLOR_DEFAULTS = ["red", "green"]

ANIM_LENGTH = 3000

def generate_ordered_transitions(attribute_values):
    """Generate one direction of transitions for each pair (3 transitions for 3 values)."""
    transitions = []
    for i, start in enumerate(attribute_values):
        for end in attribute_values[i + 1:]:
            transitions.append((start, end))
    return transitions

def flip_one_random_transition(transitions):
    """Flip the direction of one random transition in the list."""
    transitions = list(transitions)  # Make a copy
    idx = random.randint(0, len(transitions) - 1)
    start, end = transitions[idx]
    transitions[idx] = (end, start)
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
    """Generate a suite of animations (one attribute animated at a time)."""
    animations = []
    
    # Generate irregularity animations
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
    
    # Generate aspect ratio animations
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
    
    # Generate color animations
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

def main():
    # Generate all transitions (one direction per pair)
    irregularity_transitions = generate_ordered_transitions(IRREGULARITY_VALUES)
    aspect_transitions = generate_ordered_transitions(ASPECT_VALUES)
    color_transitions = generate_ordered_transitions(COLOR_VALUES)
    
    print(f"Irregularity transitions: {irregularity_transitions}")
    print(f"Aspect transitions: {aspect_transitions}")
    print(f"Color transitions: {color_transitions}")
    
    # Generate all 8 default combinations (2^3)
    default_combinations = list(product(IRREGULARITY_DEFAULTS, ASPECT_DEFAULTS, COLOR_DEFAULTS))
    
    print(f"\nGenerating {len(default_combinations)} suites")
    
    # Create output directory
    output_dir = "generated_stimuli"
    os.makedirs(output_dir, exist_ok=True)
    
    # Generate and save each suite
    for suite_idx, (def_irr, def_asp, def_col) in enumerate(default_combinations):
        # Flip one random transition per attribute type
        suite_irr_trans = flip_one_random_transition(irregularity_transitions)
        suite_asp_trans = flip_one_random_transition(aspect_transitions)
        suite_col_trans = flip_one_random_transition(color_transitions)
        
        suite = generate_suite(
            def_irr, def_asp, def_col,
            suite_irr_trans,
            suite_asp_trans,
            suite_col_trans
        )
        
        # Save to file with letter naming (A, B, C, ...)
        filename = f"{string.ascii_uppercase[suite_idx]}.json"
        filepath = os.path.join(output_dir, filename)
        
        with open(filepath, 'w') as f:
            json.dump(suite, f, indent=4)
        
        print(f"Generated {filename}: defaults = (irregularity={def_irr}, aspect={def_asp}, color={def_col})")
    
    animations_per_suite = len(irregularity_transitions) + len(aspect_transitions) + len(color_transitions)
    print(f"\nGenerated {len(default_combinations)} suites")
    print(f"Each suite contains {animations_per_suite} animations")
    print(f"Files saved to '{output_dir}/' directory")

if __name__ == "__main__":
    main()
