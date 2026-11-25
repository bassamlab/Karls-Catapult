import matplotlib.pyplot
import numpy 

def plot_initial_conditions(p0, v0):
    matplotlib.pyplot.quiver(p0[0], p0[1], v0[0], v0[1], scale=100, angles="xy", color='blue', alpha=0.5)
    matplotlib.pyplot.scatter(p0[0], p0[1], label="Initial Condition", color='blue', alpha=0.5)

    matplotlib.pyplot.title("Ball Throw: Initial Condition")
    matplotlib.pyplot.xlabel("x")
    matplotlib.pyplot.ylabel("y")
    matplotlib.pyplot.ylim(0, 10)
    matplotlib.pyplot.xlim(-1, 21)
    matplotlib.pyplot.legend()
    matplotlib.pyplot.grid(True)
    matplotlib.pyplot.show()
    
def plot_true_trajectory(p0, v0, s_true):
    matplotlib.pyplot.quiver(p0[0], p0[1], v0[0], v0[1], scale=100, angles="xy", color='blue', alpha=0.5)
    matplotlib.pyplot.scatter(p0[0], p0[1], label="Initial Condition", color='blue', alpha=0.5)

    matplotlib.pyplot.plot(s_true[0,:],s_true[1,:],label="Optimal", color='orange', alpha=0.5)

    matplotlib.pyplot.title("Catapult: Optimal Trajectory")
    matplotlib.pyplot.xlabel("$s_x [m]$")
    matplotlib.pyplot.ylabel("$s_y [m]$")
    matplotlib.pyplot.ylim(0, 10)
    matplotlib.pyplot.xlim(-1, 21)
    matplotlib.pyplot.legend()
    matplotlib.pyplot.grid(True)
    matplotlib.pyplot.show()
    
def plot_observations(p0, v0, s_observed):
    matplotlib.pyplot.quiver(p0[0], p0[1], v0[0], v0[1], scale=100, angles="xy", color='blue', alpha=0.5)
    matplotlib.pyplot.scatter(p0[0], p0[1], label="Initial Condition", color='blue', alpha=0.5)
    matplotlib.pyplot.scatter(s_observed[0,:],s_observed[1,:],label='Noisy Observations', color='red', alpha=0.5)

    matplotlib.pyplot.title("Catapult: Observed Trajectory")
    matplotlib.pyplot.xlabel("$s_x [m]$")
    matplotlib.pyplot.ylabel("$s_y [m]$")
    matplotlib.pyplot.ylim(0, 10)
    matplotlib.pyplot.xlim(-1, 21)
    matplotlib.pyplot.legend()
    matplotlib.pyplot.grid(True)
    matplotlib.pyplot.show()
    
def plot_true_and_observations(p0, v0, s_true, s_observed):
    matplotlib.pyplot.quiver(p0[0], p0[1], v0[0], v0[1], scale=100, angles="xy", color='blue', alpha=0.5)
    matplotlib.pyplot.scatter(p0[0], p0[1], label="Initial Condition", color='blue', alpha=0.5)
    matplotlib.pyplot.scatter(s_observed[0,:],s_observed[1,:],label='Noisy Observations', color='red', alpha=0.5)
    matplotlib.pyplot.plot(s_true[0,:],s_true[1,:],label="Optimal", color='orange', alpha=0.5)

    matplotlib.pyplot.title("Catapult: Observed Trajectory")
    matplotlib.pyplot.xlabel("$s_x [m]$")
    matplotlib.pyplot.ylabel("$s_y [m]$")
    matplotlib.pyplot.ylim(0, 10)
    matplotlib.pyplot.xlim(-1, 21)
    matplotlib.pyplot.legend()
    matplotlib.pyplot.grid(True)
    matplotlib.pyplot.show()
    
def plot_estimation(p0, v0, s_true, s_observed, s_estimated):
    matplotlib.pyplot.quiver(p0[0], p0[1], v0[0], v0[1], scale=100, angles="xy", color='blue', alpha=0.5)
    matplotlib.pyplot.scatter(p0[0], p0[1], label="Initial Condition", color='blue', alpha=0.5)

    matplotlib.pyplot.plot(s_true[0,:],s_true[1,:],label="Optimal", color='orange', alpha=0.5)
    matplotlib.pyplot.scatter(s_observed[0,:],s_observed[1,:],label='Noisy Measurements', color='red', alpha=0.5)
    matplotlib.pyplot.plot(s_estimated[0,:],s_estimated[1,:],label='Kalman Filter Estimate', linestyle='dashed', color='blue')
    matplotlib.pyplot.scatter(s_estimated[0,:],s_estimated[1,:],color='blue')

    matplotlib.pyplot.title("Catapult: Estiamted vs. True Trajectory")
    matplotlib.pyplot.xlabel("$s_x [m]$")
    matplotlib.pyplot.ylabel("$s_y [m]$")
    matplotlib.pyplot.ylim(0, 10)
    matplotlib.pyplot.xlim(-1, 21)
    matplotlib.pyplot.legend()
    matplotlib.pyplot.grid(True)
    matplotlib.pyplot.show()
    
def plot_error(t, s_error):
    matplotlib.pyplot.bar(t, s_error, label="Error", color='green', width=0.09, alpha=0.5)

    matplotlib.pyplot.title("Catapult: Error of Measurements")
    matplotlib.pyplot.xlabel("t")
    matplotlib.pyplot.ylabel("error")
    matplotlib.pyplot.legend()
    matplotlib.pyplot.show()
    
def plot_velocity_estimation(t, v_true, v_etimated, title_prefix=""):
    matplotlib.pyplot.plot(t,v_true,label="Optimal Velocity", color='orange', alpha=0.5)
    matplotlib.pyplot.plot(t,v_etimated,label="Estimated Velocity", color='blue', linestyle='dashed', alpha=0.5)

    matplotlib.pyplot.title("Ball Throw: Velocity Estimation " + title_prefix)
    matplotlib.pyplot.xlabel("x")
    matplotlib.pyplot.ylabel("y")
    matplotlib.pyplot.ylim(numpy.min((numpy.min(v_true), numpy.min(v_etimated)))-0.5, numpy.max((numpy.max(v_etimated), numpy.max(v_true)))+0.5)
    matplotlib.pyplot.legend()
    matplotlib.pyplot.grid(True)
    matplotlib.pyplot.show()
    
def plot_error_comparison(t_observed, s_error_observed, t_estimated, s_error_estimated):
    matplotlib.pyplot.bar(t_observed, s_error_observed, label="Measurements Error", color='green', width=0.09, alpha=0.5)
    matplotlib.pyplot.bar(t_estimated, s_error_estimated, label="Estimattion Error", color='red', width=0.09, alpha=0.5)

    matplotlib.pyplot.title("Ball Throw: Error of Measurements")
    matplotlib.pyplot.xlabel("t")
    matplotlib.pyplot.ylabel("error")
    matplotlib.pyplot.legend()
    matplotlib.pyplot.show()
